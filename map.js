/* =========================================================
   RAD-V GPS MAPPING
   Google Spreadsheet -> Leaflet Map + Table
========================================================= */

const SPREADSHEET_ID =
    "1xLhZmmkAYq8_xfaccntf8GUCx0XZZ8y9Rn7KZ0Ob_2U";

const SHEET_NAME = "data";

const REFRESH_INTERVAL = 10000; // 10 detik


/* =========================================================
   GLOBAL
========================================================= */

let radMap = null;
let pointLayer = null;
let latestMarker = null;


/* =========================================================
   INIT MAP
========================================================= */

function initRadiationMap() {

    if (typeof L === "undefined") {
        console.error("Leaflet belum dimuat.");
        return;
    }

    const mapElement = document.getElementById("radMap");

    if (!mapElement) {
        console.error("Element #radMap tidak ditemukan.");
        return;
    }

    /* -----------------------------------------
       Buat peta
    ----------------------------------------- */

    radMap = L.map("radMap", {
        zoomControl: true,
        attributionControl: true
    }).setView([-5.4, 105.25], 15);


    /* -----------------------------------------
       OpenStreetMap
    ----------------------------------------- */

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 20,
            attribution: "&copy; OpenStreetMap contributors"
        }
    ).addTo(radMap);


    /* -----------------------------------------
       Layer marker
    ----------------------------------------- */

    pointLayer = L.layerGroup().addTo(radMap);


    /* -----------------------------------------
       Pastikan ukuran peta benar
    ----------------------------------------- */

    setTimeout(() => {

        if (radMap) {
            radMap.invalidateSize();
        }

    }, 500);


    /* -----------------------------------------
       Load pertama
    ----------------------------------------- */

    loadRadiationMap();


    /* -----------------------------------------
       Auto refresh
    ----------------------------------------- */

    setInterval(() => {

        loadRadiationMap();

    }, REFRESH_INTERVAL);
}


/* =========================================================
   GOOGLE GVIZ URL
========================================================= */

function getGvizUrl() {

    return (
        "https://docs.google.com/spreadsheets/d/" +
        SPREADSHEET_ID +
        "/gviz/tq?tqx=out:json&sheet=" +
        encodeURIComponent(SHEET_NAME)
    );
}


/* =========================================================
   NORMALIZE HEADER
========================================================= */

function normalizeHeader(value) {

    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^\w]/g, "");
}


/* =========================================================
   FIND COLUMN
========================================================= */

function findColumn(headers, aliases) {

    const normalizedHeaders =
        headers.map(normalizeHeader);


    /* -----------------------------------------
       Cocok persis
    ----------------------------------------- */

    for (const alias of aliases) {

        const normalizedAlias =
            normalizeHeader(alias);

        const index =
            normalizedHeaders.indexOf(normalizedAlias);

        if (index !== -1) {
            return index;
        }
    }


    /* -----------------------------------------
       Cocok sebagian
    ----------------------------------------- */

    for (let i = 0; i < normalizedHeaders.length; i++) {

        for (const alias of aliases) {

            const normalizedAlias =
                normalizeHeader(alias);

            if (
                normalizedAlias &&
                normalizedHeaders[i].includes(normalizedAlias)
            ) {
                return i;
            }
        }
    }

    return -1;
}


/* =========================================================
   PARSE GOOGLE GVIZ
========================================================= */

function parseGvizResponse(text) {

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1) {

        throw new Error(
            "Format data Google Spreadsheet tidak dikenali."
        );
    }

    return JSON.parse(
        text.substring(start, end + 1)
    );
}


/* =========================================================
   GET CELL VALUE
========================================================= */

function valueFromCell(row, index, formatted = false) {

    if (
        index < 0 ||
        !row ||
        !row.c ||
        !row.c[index]
    ) {
        return null;
    }

    const cell = row.c[index];

    if (formatted && cell.f !== undefined) {
        return cell.f;
    }

    return cell.v;
}


/* =========================================================
   FORMAT TIMESTAMP
   Hasil:
   DD/MM/YYYY HH:mm:ss

   Contoh:
   Date(2026,2,1,15,7,44)
   menjadi:
   01/03/2026 15:07:44
========================================================= */

function formatTimestamp(row, index) {

    if (
        !row ||
        !row.c ||
        index < 0 ||
        !row.c[index]
    ) {
        return "";
    }

    const cell = row.c[index];

    /*
     * Ambil nilai asli dari Google GViz.
     *
     * Contoh:
     * Date(2026,2,1,15,7,44)
     */
    const value = cell.v;

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    const text = String(value).trim();


    /* =====================================================
       FORMAT GOOGLE GVIZ
       
       Date(2026,2,1,15,7,44)
       
       Google:
       0 = Januari
       1 = Februari
       2 = Maret
    ===================================================== */

    const match = text.match(
        /^Date\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/
    );


    if (match) {

        const year = Number(match[1]);

        const month = Number(match[2]) + 1;

        const day = Number(match[3]);

        const hour = Number(match[4]);

        const minute = Number(match[5]);

        const second = Number(match[6]);


        return (
            String(day).padStart(2, "0") +
            "/" +
            String(month).padStart(2, "0") +
            "/" +
            String(year) +
            " " +
            String(hour).padStart(2, "0") +
            ":" +
            String(minute).padStart(2, "0") +
            ":" +
            String(second).padStart(2, "0")
        );
    }


    /*
     * Jika bukan Date(...)
     *
     * Coba gunakan format yang diberikan Google Sheets.
     */
    if (
        cell.f !== undefined &&
        cell.f !== null &&
        String(cell.f).trim() !== ""
    ) {

        const formatted =
            String(cell.f).trim();


        /*
         * Jika sudah DD/MM/YYYY HH:mm:ss
         * biarkan.
         */
        const normalFormat =
            formatted.match(
                /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/
            );


        if (normalFormat) {

            return (
                String(normalFormat[1]).padStart(2, "0") +
                "/" +
                String(normalFormat[2]).padStart(2, "0") +
                "/" +
                normalFormat[3] +
                " " +
                String(normalFormat[4]).padStart(2, "0") +
                ":" +
                String(normalFormat[5]).padStart(2, "0") +
                ":" +
                String(normalFormat[6]).padStart(2, "0")
            );
        }


        return formatted;
    }


    return text;
}

// =========================================================
// PARSE TIMESTAMP UNTUK SORTING
// Terbaru -> Terlama
// =========================================================

function getTimestampMillis(row, index) {

    if (
        !row ||
        !row.c ||
        index < 0 ||
        !row.c[index]
    ) {
        return 0;
    }


    const cell =
        row.c[index];


    const value =
        cell.v;


    if (
        value === null ||
        value === undefined
    ) {
        return 0;
    }


    const text =
        String(value).trim();


    /* -----------------------------------------
       GOOGLE GVIZ DATE
       
       Contoh:
       Date(2026,7,23,1,56,1)
       
       Bulan:
       0 = Januari
       7 = Agustus
    ----------------------------------------- */

    const match =
        text.match(
            /^Date\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/
        );


    if (match) {

        const year =
            Number(match[1]);

        const month =
            Number(match[2]);

        const day =
            Number(match[3]);

        const hour =
            Number(match[4]);

        const minute =
            Number(match[5]);

        const second =
            Number(match[6]);


        return new Date(
            year,
            month,
            day,
            hour,
            minute,
            second
        ).getTime();
    }


    /* -----------------------------------------
       FORMAT DD/MM/YYYY HH:mm:ss
    ----------------------------------------- */

    const normal =
        text.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/
        );


    if (normal) {

        const day =
            Number(normal[1]);

        const month =
            Number(normal[2]) - 1;

        const year =
            Number(normal[3]);

        const hour =
            Number(normal[4]);

        const minute =
            Number(normal[5]);

        const second =
            Number(normal[6]);


        return new Date(
            year,
            month,
            day,
            hour,
            minute,
            second
        ).getTime();
    }


    /* -----------------------------------------
       COBA PARSE DATE BIASA
    ----------------------------------------- */

    const parsed =
        new Date(text);


    if (
        !Number.isNaN(
            parsed.getTime()
        )
    ) {

        return parsed.getTime();
    }


    return 0;
}

/* =========================================================
   FORMAT CELL
========================================================= */

function formatCellValue(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value);
}


/* =========================================================
   RADIATION LEVEL
========================================================= */

function radiationLevel(usv) {

    if (!Number.isFinite(usv)) {
        return "unknown";
    }


    if (usv < 0.3) {
        return "safe";
    }


    if (usv < 1.0) {
        return "medium";
    }


    return "high";
}


/* =========================================================
   MARKER COLOR
========================================================= */

function markerColor(level) {

    if (level === "safe") {
        return "#22c55e";
    }

    if (level === "medium") {
        return "#f59e0b";
    }

    if (level === "high") {
        return "#ef4444";
    }

    return "#6b7280";
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   CREATE MARKER
========================================================= */

function makeMarker(
    lat,
    lon,
    usv,
    cpm,
    isLatest
) {

    const level =
        radiationLevel(usv);


    const color =
        isLatest
            ? "#2563eb"
            : markerColor(level);


    const marker =
        L.circleMarker(
            [lat, lon],
            {
                radius: isLatest ? 9 : 5,

                color: color,

                weight: isLatest ? 3 : 1,

                fillColor: color,

                fillOpacity: 0.8
            }
        );


    marker.bindPopup(`

        <div style="min-width:180px">

            <strong>☢️ RAD-V</strong>

            <br>

            Latitude:
            ${lat.toFixed(6)}

            <br>

            Longitude:
            ${lon.toFixed(6)}

            <br>

            μSv/h:
            ${
                Number.isFinite(usv)
                    ? usv.toFixed(3)
                    : "-"
            }

            <br>

            CPM:
            ${
                Number.isFinite(cpm)
                    ? cpm.toFixed(2)
                    : "-"
            }

            ${
                isLatest
                    ? "<br><strong>🔵 POSISI TERBARU</strong>"
                    : ""
            }

        </div>

    `);


    return marker;
}


/* =========================================================
   LOAD DATA SPREADSHEET
========================================================= */

async function loadRadiationMap() {

    const mapInfo =
        document.getElementById("mapInfo");

    const tableInfo =
        document.getElementById("tableInfo");


    try {

        if (mapInfo) {
            mapInfo.textContent =
                "Mengambil data GPS...";
        }


        const response =
            await fetch(
                getGvizUrl(),
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const text =
            await response.text();


        const data =
            parseGvizResponse(text);


        if (
            !data.table ||
            !data.table.cols ||
            !data.table.rows
        ) {

            throw new Error(
                "Data Spreadsheet kosong atau tidak valid."
            );
        }


        /* -----------------------------------------
           HEADER
        ----------------------------------------- */

        const headers =
            data.table.cols.map(
                col =>
                    col.label ||
                    col.id ||
                    ""
            );


        /* -----------------------------------------
           CARI KOLOM
        ----------------------------------------- */

        const timestampIndex =
            findColumn(
                headers,
                [
                    "timestamp",
                    "time",
                    "waktu",
                    "tanggal",
                    "date"
                ]
            );


        const latIndex =
            findColumn(
                headers,
                [
                    "latitude",
                    "lat",
                    "latitude gps",
                    "gps latitude"
                ]
            );


        const lonIndex =
            findColumn(
                headers,
                [
                    "longitude",
                    "lon",
                    "lng",
                    "longitude gps",
                    "gps longitude"
                ]
            );


        const usvIndex =
            findColumn(
                headers,
                [
                    "uSv/h",
                    "usv/h",
                    "usv",
                    "μSv/h",
                    "µSv/h",
                    "radiation"
                ]
            );


        const cpmIndex =
            findColumn(
                headers,
                [
                    "CPM",
                    "cpm",
                    "counts per minute"
                ]
            );


        /* -----------------------------------------
           VALIDASI GPS
        ----------------------------------------- */

        if (
            latIndex === -1 ||
            lonIndex === -1
        ) {

            throw new Error(
                "Kolom Latitude / Longitude tidak ditemukan."
            );
        }


        /* -----------------------------------------
           POINT DATA
        ----------------------------------------- */

        const points = [];

        const pointByRowIndex = {};


        for (
            let rowIndex = 0;
            rowIndex < data.table.rows.length;
            rowIndex++
        ) {

            const row =
                data.table.rows[rowIndex];


            const lat =
                Number(
                    valueFromCell(
                        row,
                        latIndex
                    )
                );


            const lon =
                Number(
                    valueFromCell(
                        row,
                        lonIndex
                    )
                );


            const usv =
                Number(
                    valueFromCell(
                        row,
                        usvIndex
                    )
                );


            const cpm =
                Number(
                    valueFromCell(
                        row,
                        cpmIndex
                    )
                );


            if (
                Number.isFinite(lat) &&
                Number.isFinite(lon) &&
                lat >= -90 &&
                lat <= 90 &&
                lon >= -180 &&
                lon <= 180 &&
                !(lat === 0 && lon === 0)
            ) {

               const point = {

    lat: lat,

    lon: lon,

    usv:
        Number.isFinite(usv)
            ? usv
            : NaN,

    cpm:
        Number.isFinite(cpm)
            ? cpm
            : NaN,

    timestamp:
        getTimestampMillis(
            row,
            timestampIndex
        ),

    originalIndex:
        rowIndex
};


                points.push(point);


                pointByRowIndex[rowIndex] =
                    point;
            }
        }

const latestPoint =
    points.length > 0
        ? points.reduce(
            (latest, point) =>
                point.timestamp >
                latest.timestamp
                    ? point
                    : latest
        )
        : null;
       
        window.radVPointByRowIndex =
            pointByRowIndex;


     /* -----------------------------------------
   UPDATE TABLE
----------------------------------------- */

renderSpreadsheetTable(
    headers,
    data.table.rows,
    timestampIndex,
    latIndex,
    lonIndex,
    usvIndex,
    cpmIndex,
    points
);


        /* -----------------------------------------
           TIDAK ADA GPS
        ----------------------------------------- */

        if (points.length === 0) {

            if (mapInfo) {

                mapInfo.textContent =
                    "Belum ada koordinat GPS yang valid.";
            }

            return;
        }


/* -----------------------------------------
   CLEAR MARKER
----------------------------------------- */

if (pointLayer) {
    pointLayer.clearLayers();
}


/* -----------------------------------------
   HAPUS SEMUA GARIS LAMA
----------------------------------------- */

radMap.eachLayer(function (layer) {

    if (
        layer instanceof L.Polyline &&
        !(layer instanceof L.CircleMarker)
    ) {
        radMap.removeLayer(layer);
    }

});


        /* -----------------------------------------
           KOORDINAT
        ----------------------------------------- */

        const latLngs =
            points.map(
                point => [
                    point.lat,
                    point.lon
                ]
            );


        /* -----------------------------------------
           MARKER
        ----------------------------------------- */

        points.forEach(
    (point) => {

        const marker =
            makeMarker(
                point.lat,
                point.lon,
                point.usv,
                point.cpm,
                point === latestPoint
            );

        marker.addTo(
            pointLayer
        );
    }
);


        /* -----------------------------------------
           DATA TERBARU
        ----------------------------------------- */

       const latest =
    latestPoint;


        /* -----------------------------------------
           HAPUS MARKER TERBARU LAMA
        ----------------------------------------- */

        if (latestMarker) {

            radMap.removeLayer(
                latestMarker
            );

            latestMarker = null;
        }


        /* -----------------------------------------
           LINGKARAN POSISI TERBARU
        ----------------------------------------- */

        latestMarker =
            L.circleMarker(
                [
                    latest.lat,
                    latest.lon
                ],
                {
                    radius: 12,

                    color: "#2563eb",

                    weight: 3,

                    fillColor: "#2563eb",

                    fillOpacity: 0.15
                }
            ).addTo(radMap);


        latestMarker.bindPopup(`

            <strong>🔵 POSISI TERBARU RAD-V</strong>

            <br>

            Latitude:
            ${latest.lat.toFixed(6)}

            <br>

            Longitude:
            ${latest.lon.toFixed(6)}

            <br>

            μSv/h:
            ${
                Number.isFinite(latest.usv)
                    ? latest.usv.toFixed(3)
                    : "-"
            }

            <br>

            CPM:
            ${
                Number.isFinite(latest.cpm)
                    ? latest.cpm.toFixed(2)
                    : "-"
            }

        `);


        /* -----------------------------------------
           UPDATE KARTU DASHBOARD
        ----------------------------------------- */

        const latEl =
            document.getElementById(
                "latitude"
            );


        const lonEl =
            document.getElementById(
                "longitude"
            );


        const usvEl =
            document.getElementById(
                "usv"
            );


        const cpmEl =
            document.getElementById(
                "cpm"
            );


        if (latEl) {

            latEl.textContent =
                latest.lat.toFixed(6);
        }


        if (lonEl) {

            lonEl.textContent =
                latest.lon.toFixed(6);
        }


        if (
            usvEl &&
            Number.isFinite(latest.usv)
        ) {

            usvEl.textContent =
                latest.usv.toFixed(2);
        }


        if (
            cpmEl &&
            Number.isFinite(latest.cpm)
        ) {

            cpmEl.textContent =
                latest.cpm.toFixed(0);
        }


        /* -----------------------------------------
           FIT MAP
        ----------------------------------------- */

        if (!radMap._radVHasFitted) {

            radMap.fitBounds(
                L.latLngBounds(latLngs),
                {
                    padding: [30, 30]
                }
            );


            radMap._radVHasFitted =
                true;
        }


        /* -----------------------------------------
           MAP INFO
        ----------------------------------------- */

        if (mapInfo) {

            mapInfo.textContent =
                `${points.length} titik GPS | ` +
                `Posisi terbaru: ` +
                `${latest.lat.toFixed(6)}, ` +
                `${latest.lon.toFixed(6)} | ` +
                `Update otomatis ` +
                `${REFRESH_INTERVAL / 1000} detik`;
        }

    } catch (error) {

        console.error(
            "RAD-V Mapping Error:",
            error
        );


        if (mapInfo) {

            mapInfo.textContent =
                "Gagal mengambil data Spreadsheet.";
        }


        if (tableInfo) {

            tableInfo.textContent =
                "Gagal mengambil data Spreadsheet.";
        }
    }
}


/* =========================================================
   RENDER TABLE
========================================================= */

function renderSpreadsheetTable(
    headers,
    rows,
    timestampIndex,
    latIndex,
    lonIndex,
    usvIndex,
    cpmIndex,
    points
) {

    const head =
        document.getElementById(
            "radiationTableHead"
        );


    const body =
        document.getElementById(
            "radiationTableBody"
        );


    const info =
        document.getElementById(
            "tableInfo"
        );


    if (!head || !body) {
        return;
    }


    /* -----------------------------------------
       HEADER
    ----------------------------------------- */

    head.innerHTML = `

        <tr>

            <th>No.</th>

            ${headers
                .map(
                    header =>
                        `<th>${escapeHtml(
                            header || "-"
                        )}</th>`
                )
                .join("")
            }

            <th>Peta</th>

        </tr>
    `;


    body.innerHTML = "";


    /* -----------------------------------------
       KOSONG
    ----------------------------------------- */

    if (!rows.length) {

        body.innerHTML = `

            <tr>

                <td
                    colspan="${headers.length + 2}"
                    class="table-empty"
                >
                    Belum ada data pada Google Spreadsheet.
                </td>

            </tr>
        `;


        if (info) {
            info.textContent = "0 data";
        }

        return;
    }


 /* -----------------------------------------
   ROW
----------------------------------------- */

/* -----------------------------------------
   URUTKAN DATA TERBARU DI ATAS
----------------------------------------- */

const sortedRows =
    rows
        .map(
            (row, originalIndex) => ({
                row: row,
                originalIndex: originalIndex,
                timestamp:
                    getTimestampMillis(
                        row,
                        timestampIndex
                    )
            })
        )
        .sort(
            (a, b) =>
                b.timestamp -
                a.timestamp
        );


/* -----------------------------------------
   RENDER ROW
----------------------------------------- */

sortedRows.forEach(
    (item, displayIndex) => {

        const row =
            item.row;

        const originalIndex =
            item.originalIndex;


        const lat =
            Number(
                valueFromCell(
                    row,
                    latIndex
                )
            );


        const lon =
            Number(
                valueFromCell(
                    row,
                    lonIndex
                )
            );


        const usv =
            Number(
                valueFromCell(
                    row,
                    usvIndex
                )
            );


        const cpm =
            Number(
                valueFromCell(
                    row,
                    cpmIndex
                )
            );


       /* -----------------------------------------
   CARI POINT SESUAI BARIS ASLI
----------------------------------------- */

const point =
    window.radVPointByRowIndex
        ? window.radVPointByRowIndex[
            originalIndex
        ]
        : null;


/* -----------------------------------------
   TENTUKAN DATA TERBARU
----------------------------------------- */

const latestOriginalIndex =
    sortedRows.length > 0
        ? sortedRows[0].originalIndex
        : -1;


const isLatest =
    originalIndex === latestOriginalIndex;


        const level =
            radiationLevel(usv);


        const tr =
            document.createElement("tr");


        if (isLatest) {

            tr.classList.add(
                "latest-row"
            );
        }


        /* -----------------------------------------
           CELL DATA
        ----------------------------------------- */

        const values =
            headers
                .map(
                    (header, colIndex) => {

                        let value;


                        if (
                            colIndex ===
                            timestampIndex
                        ) {

                            value =
                                formatTimestamp(
                                    row,
                                    colIndex
                                );

                        } else {

                            value =
                                formatCellValue(
                                    valueFromCell(
                                        row,
                                        colIndex
                                    )
                                );
                        }


                        /* --------------------------------
                           WARNA RADIATION
                        -------------------------------- */

                        let className = "";


                        if (
                            colIndex ===
                            usvIndex
                        ) {

                            if (
                                level === "safe"
                            ) {

                                className =
                                    "radiation-low";

                            } else if (
                                level === "medium"
                            ) {

                                className =
                                    "radiation-medium";

                            } else if (
                                level === "high"
                            ) {

                                className =
                                    "radiation-high";
                            }
                        }


                        return `
                            <td class="${className}">
                                ${escapeHtml(value)}
                            </td>
                        `;
                    }
                )
                .join("");


        /* -----------------------------------------
           BUTTON PETA
        ----------------------------------------- */

        const mapButton =
            Number.isFinite(lat) &&
            Number.isFinite(lon)

                ? `
                    <button
                        type="button"
                        class="table-map-button"
                    >
                        📍 LIHAT
                    </button>
                `

                : "-";


        /* -----------------------------------------
           BUAT BARIS
        ----------------------------------------- */

        tr.innerHTML = `

            <td>
                ${displayIndex + 1}
            </td>

            ${values}

            <td>
                ${mapButton}
            </td>
        `;


        /* -----------------------------------------
           CLICK ROW
        ----------------------------------------- */

        tr.addEventListener(
            "click",
            () => {

                if (
                    !Number.isFinite(lat) ||
                    !Number.isFinite(lon) ||
                    !radMap
                ) {

                    return;
                }


                /* -------------------------------
                   Fokus peta
                ------------------------------- */

                radMap.setView(
                    [lat, lon],
                    Math.max(
                        radMap.getZoom(),
                        17
                    ),
                    {
                        animate: true
                    }
                );


                /* -------------------------------
                   Marker sementara
                ------------------------------- */

                const marker =
                    makeMarker(
                        lat,
                        lon,
                        Number.isFinite(usv)
                            ? usv
                            : NaN,
                        Number.isFinite(cpm)
                            ? cpm
                            : NaN,
                        isLatest
                    );


                marker.addTo(
                    pointLayer
                );


                marker.openPopup();


                /* -------------------------------
                   Hapus marker setelah 4 detik
                ------------------------------- */

                setTimeout(
                    () => {

                        if (
                            pointLayer &&
                            pointLayer.hasLayer(
                                marker
                            )
                        ) {

                            pointLayer.removeLayer(
                                marker
                            );
                        }

                    },
                    4000
                );

            }
        );


        body.appendChild(tr);

    }
);

    /* -----------------------------------------
       TABLE INFO
    ----------------------------------------- */

    if (info) {

        info.textContent =
            `${rows.length} data | ` +
            `klik baris untuk melihat posisi pada peta`;
    }
}


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initRadiationMap
);
