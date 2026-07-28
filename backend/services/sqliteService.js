const initSqlJs = require("sql.js");
const path = require("path");

async function getSQLEngine() {

    if (!SQL) {

        SQL = await initSqlJs({

            locateFile: file =>
                path.join(
                    process.cwd(),
                    "node_modules",
                    "sql.js",
                    "dist",
                    file
                )

        });

    }

    return SQL;
}