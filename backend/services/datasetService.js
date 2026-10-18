const { parse } = require("csv-parse/sync");
const { randomUUID } = require("node:crypto");

const LIMITS = Object.freeze({
  bytes: 2 * 1024 * 1024,
  rows: 10_000,
  columns: 50,
  cells: 200_000,
  fieldCharacters: 4_096,
  sampleRows: 10,
  retentionMs: 30 * 60 * 1000,
  storedDatasets: 10,
});

function clientError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function inferValueType(value) {
  if (/^(true|false)$/i.test(value)) return "BOOLEAN";
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(value) && Number.isFinite(Number(value))) {
    if (!value.includes(".") && !Number.isSafeInteger(Number(value))) return "TEXT";
    return value.includes(".") ? "DECIMAL" : "INTEGER";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value) return "DATE";
  }
  return "TEXT";
}

function quantile(sorted, percentile) {
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return sorted[lower + 1] === undefined
    ? sorted[lower]
    : sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
}

function numericProfile(values) {
  const sorted = values.map(Number).sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const inliers = sorted.filter((value) => value >= lowerFence && value <= upperFence);
  const binCount = min === max ? 1 : Math.min(10, Math.max(4, Math.ceil(Math.sqrt(sorted.length))));
  const histogram = Array.from({ length: binCount }, (_, index) => ({
    start: min + ((max - min) * index) / binCount,
    end: min + ((max - min) * (index + 1)) / binCount,
    count: 0,
  }));
  for (const value of sorted) {
    const index = min === max ? 0 : Math.min(binCount - 1, Math.floor(((value - min) / (max - min)) * binCount));
    histogram[index].count += 1;
  }
  return {
    min,
    q1,
    median,
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    q3,
    max,
    whiskerMin: inliers[0] ?? min,
    whiskerMax: inliers[inliers.length - 1] ?? max,
    outlierCount: sorted.length - inliers.length,
    histogram,
  };
}

function profileValues(values, type) {
  const uniqueCount = new Set(values).size;
  if (type === "INTEGER" || type === "DECIMAL") {
    return { uniqueCount, numeric: numericProfile(values) };
  }
  if (type === "DATE") {
    const sorted = [...values].sort();
    return { uniqueCount, date: { min: sorted[0], max: sorted[sorted.length - 1] } };
  }
  const frequencies = new Map();
  for (const value of values) frequencies.set(value, (frequencies.get(value) || 0) + 1);
  const topValues = [...frequencies]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([value, count]) => ({ value: value.slice(0, 80), count }));
  return { uniqueCount, topValues };
}

function inspectCSV(buffer) {
  if (!buffer.length) throw clientError("CSV is empty.");
  if (buffer.length > LIMITS.bytes) throw clientError("CSV exceeds 2 MiB.", 413);

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw clientError("Use UTF-8 encoding (an optional UTF-8 BOM is accepted).");
  }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) {
    throw clientError("CSV contains unsupported control characters.");
  }

  let records;
  let recordCount = 0;
  try {
    records = parse(text, {
      bom: true,
      skip_empty_lines: true,
      max_record_size: 65_536,
      on_record(record) {
        recordCount += 1;
        if (recordCount > LIMITS.rows + 1) throw clientError("CSV exceeds 10,000 data rows.");
        if (record.length > LIMITS.columns) throw clientError("CSV exceeds 50 columns.");
        if (record.some((value) => value.length > LIMITS.fieldCharacters)) {
          throw clientError("A field exceeds 4,096 characters.");
        }
        return record;
      },
    });
  } catch (error) {
    if (error.status) throw error;
    const location = Number.isInteger(error.lines) ? ` near line ${error.lines}` : "";
    throw clientError(`Malformed CSV${location}: check quoting and consistent column counts.`);
  }

  if (records.length < 2) throw clientError("Include a header and at least one data row.");
  const headers = records.shift().map((value) => value.trim());
  if (headers.length > LIMITS.columns) throw clientError("CSV exceeds 50 columns.");
  if (records.length * headers.length > LIMITS.cells) throw clientError("CSV exceeds 200,000 data cells.");
  if (headers.some((value) => !value || value.length > 128)) {
    throw clientError("Column names must contain 1–128 characters.");
  }
  if (new Set(headers.map((value) => value.toLowerCase())).size !== headers.length) {
    throw clientError("Column names must be unique (ignoring case and surrounding spaces).");
  }

  const columns = headers.map((name, index) => {
    const types = new Set();
    let missing = 0;
    const values = [];
    for (const row of records) {
      const value = row[index].trim();
      if (!value) missing += 1;
      else {
        values.push(value);
        types.add(inferValueType(value));
      }
    }
    if (types.has("DECIMAL")) types.delete("INTEGER");
    const type = types.size === 0 ? "UNKNOWN" : types.size === 1 ? [...types][0] : "TEXT";
    return {
      name,
      type,
      missing,
      ...(values.length ? profileValues(values, type) : { uniqueCount: 0 }),
    };
  });

  const missingCells = columns.reduce((sum, column) => sum + column.missing, 0);
  const duplicateRows = records.length - new Set(records.map((row) => JSON.stringify(row))).size;

  return {
    columns,
    rows: records,
    rowCount: records.length,
    summary: {
      missingCells,
      duplicateRows,
      completeness: 1 - missingCells / (records.length * headers.length),
    },
    sampleRows: records.slice(0, LIMITS.sampleRows).map((row) =>
      row.map((value) => value.length > 200 ? `${value.slice(0, 200)}…` : value)),
  };
}

function createStore(now = Date.now) {
  const datasets = new Map();
  function sweep() {
    for (const [owner, dataset] of datasets) {
      if (dataset.expiresAt <= now()) datasets.delete(owner);
    }
  }
  function get(owner, id) {
    sweep();
    const dataset = datasets.get(owner);
    if (!dataset || dataset.id !== id) {
      throw clientError("Dataset not found or expired. Upload it again.", 404);
    }
    return dataset;
  }
  return {
    sweep,
    put(owner, buffer, filename) {
      sweep();
      if (!datasets.has(owner) && datasets.size >= LIMITS.storedDatasets) {
        throw clientError("Dataset capacity reached. Try again after a dataset expires.", 503);
      }
      const dataset = {
        ...inspectCSV(buffer),
        id: randomUUID(),
        filename,
        expiresAt: now() + LIMITS.retentionMs,
      };
      datasets.set(owner, dataset);
      return dataset;
    },
    get,
    delete(owner, id) {
      get(owner, id);
      datasets.delete(owner);
    },
  };
}

function toPreview(dataset) {
  return {
    id: dataset.id,
    filename: dataset.filename,
    columns: dataset.columns,
    rowCount: dataset.rowCount,
    summary: dataset.summary,
    sampleRows: dataset.sampleRows,
    expiresAt: new Date(dataset.expiresAt).toISOString(),
  };
}

module.exports = { LIMITS, inspectCSV, createStore, toPreview };
