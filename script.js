// =========================================================
// RAD-V PIN SECURITY
// =========================================================

const RADV_PIN = "1234";

let radVAuthenticated = false;


// =========================================================
// MQTT
// =========================================================

const MQTT_HOST =
    "68417029aa9e4dffb745d0d102bef6be.s1.eu.hivemq.cloud";

const MQTT_PORT = 8884;

const MQTT_USERNAME = "radv";

const MQTT_PASSWORD =
    "122130148";


const CONTROL_TOPIC =
    "rc/control";

const SWITCH1_TOPIC =
    "rc/switch1";

const SWITCH2_TOPIC =
    "rc/switch2";

const DATA_TOPIC =
    "rc/data";


let mqttClient = null;

let activeControl = null;


// =========================================================
// STATE RAD-V
// =========================================================

// Saklar 1:
// STOP = pengukuran boleh dimulai
// JALAN = kontrol RC aktif

let switch1State = "STOP";


// Saklar 2:
// SELESAI = tidak mengukur
// MENGUKUR = sedang mengukur

let switch2State = "SELESAI";


// Status pengukuran
// =========================================================
// STATUS PENGUKURAN
// =========================================================

let measurementActive = false;

let measurementTimer = null;


// =========================================================
// TIMER PENGUKURAN RAD-V
// =========================================================

let measurementClockTimer = null;

let measurementStartTime = null;

const MEASUREMENT_TOTAL_SECONDS = 5 * 60 + 30;

// =========================================================
// LOCK HALAMAN SAAT AWAL
// =========================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        document.body.classList.add(
            "pin-locked"
        );


        const pinInput =
            document.getElementById(
                "pinInput"
            );


        if (pinInput) {

            pinInput.focus();
        }


        updateSwitchDisplay();

        updateMeasurementDisplay();

        updateControlState();
    }
);


// =========================================================
// CEK PIN
// =========================================================

function checkPIN() {

    const pinInput =
        document.getElementById(
            "pinInput"
        );


    const pinScreen =
        document.getElementById(
            "pinScreen"
        );


    const pinError =
        document.getElementById(
            "pinError"
        );


    if (!pinInput || !pinScreen) {

        return;
    }


    const enteredPIN =
        pinInput.value.trim();


    // =====================================================
    // PIN BENAR
    // =====================================================

    if (enteredPIN === RADV_PIN) {

        radVAuthenticated = true;


        pinScreen.style.display =
            "none";


        document.body.classList.remove(
            "pin-locked"
        );


        if (pinError) {

            pinError.textContent = "";
        }


        pinInput.value = "";


        // Baru connect MQTT
        connectMQTT();


        updateControlState();


        console.log(
            "RAD-V: Akses diterima"
        );


    }

    // =====================================================
    // PIN SALAH
    // =====================================================

    else {

        radVAuthenticated = false;


        pinInput.value = "";


        if (pinError) {

            pinError.textContent =
                "PIN salah. Silakan coba lagi.";
        }


        pinInput.focus();


        console.log(
            "RAD-V: PIN salah"
        );
    }
}


// =========================================================
// CONNECT MQTT
// =========================================================

function connectMQTT() {

    // Jangan membuat koneksi kedua
    if (
        mqttClient &&
        (
            mqttClient.connected ||
            mqttClient.reconnecting
        )
    ) {

        return;
    }


    const mqttURL =
        `wss://${MQTT_HOST}:${MQTT_PORT}/mqtt`;


    const options = {

        username:
            MQTT_USERNAME,

        password:
            MQTT_PASSWORD,

        connectTimeout:
            5000,

        reconnectPeriod:
            3000,

        clean:
            true
    };


    console.log(
        "Menghubungkan MQTT..."
    );


    mqttClient =
        mqtt.connect(
            mqttURL,
            options
        );


    // =====================================================
    // MQTT CONNECTED
    // =====================================================

    mqttClient.on(
        "connect",
        function () {

            console.log(
                "MQTT Connected"
            );


            const status =
                document.getElementById(
                    "systemStatus"
                );


            if (status) {

                status.innerText =
                    "MQTT ONLINE";
            }


            // Subscribe data pengukuran
            mqttClient.subscribe(
                DATA_TOPIC,
                {
                    qos: 0
                },
                function (error) {

                    if (error) {

                        console.error(
                            "Gagal subscribe rc/data:",
                            error
                        );

                    } else {

                        console.log(
                            "Subscribe:",
                            DATA_TOPIC
                        );
                    }
                }
            );
        }
    );


    // =====================================================
    // TERIMA MQTT
    // =====================================================

    mqttClient.on(
        "message",
        function (
            topic,
            payload
        ) {

            if (
                topic !== DATA_TOPIC
            ) {

                return;
            }


            handleMeasurementData(
                payload.toString()
            );
        }
    );


    // =====================================================
    // ERROR
    // =====================================================

    mqttClient.on(
        "error",
        function (error) {

            console.error(
                "MQTT ERROR:",
                error
            );
        }
    );


    // =====================================================
    // CLOSE
    // =====================================================

    mqttClient.on(
        "close",
        function () {

            const status =
                document.getElementById(
                    "systemStatus"
                );


            if (status) {

                status.innerText =
                    "MQTT OFFLINE";
            }
        }
    );
}


// =========================================================
// PUBLISH MQTT
// =========================================================

function sendMQTT(
    topic,
    message
) {

    if (
        !mqttClient ||
        !mqttClient.connected
    ) {

        console.log(
            "MQTT belum terhubung"
        );

        return false;
    }


    mqttClient.publish(
        topic,
        message,
        {
            qos: 0,
            retain: false
        }
    );


    console.log(
        "MQTT SEND:",
        topic,
        message
    );


    return true;
}


// =========================================================
// UPDATE KONDISI SEMUA TOMBOL
// =========================================================

function updateControlState() {

    const rcButtons =
        document.querySelectorAll(
            ".control-button"
        );


    const rtbButton =
        document.querySelector(
            ".rtb-button"
        );


    const switch1 =
        document.getElementById(
            "switch1"
        );


    const switch2 =
        document.getElementById(
            "switch2"
        );


    // =====================================================
    // BELUM LOGIN
    // =====================================================

    if (!radVAuthenticated) {

        rcButtons.forEach(
            button => {

                button.disabled = true;
            }
        );


        if (rtbButton) {

            rtbButton.disabled = true;
        }


        if (switch1) {

            switch1.classList.add(
                "disabled"
            );
        }


        if (switch2) {

            switch2.classList.add(
                "disabled"
            );
        }


        return;
    }


    // =====================================================
    // SEDANG MENGUKUR
    // =====================================================

    if (measurementActive) {

        // Semua kontrol RC disabled

        rcButtons.forEach(
            button => {

                button.disabled = true;

                button.classList.remove(
                    "active"
                );
            }
        );


        // RTB disabled

        if (rtbButton) {

            rtbButton.disabled = true;
        }


        // Saklar 1 dikunci

        if (switch1) {

            switch1.classList.add(
                "disabled"
            );
        }


        // Saklar 2 tetap aktif
        // agar dapat menekan SELESAI

        if (switch2) {

            switch2.classList.remove(
                "disabled"
            );
        }


        return;
    }


    // =====================================================
    // TIDAK SEDANG MENGUKUR
    // =====================================================


    // -----------------------------------------------------
    // SAKLAR 1 = STOP
    // -----------------------------------------------------

    if (
        switch1State === "STOP"
    ) {

        // RC disabled

        rcButtons.forEach(
            button => {

                button.disabled = true;

                button.classList.remove(
                    "active"
                );
            }
        );


        // RTB disabled

        if (rtbButton) {

            rtbButton.disabled = true;
        }


        // Saklar 1 aktif

        if (switch1) {

            switch1.classList.remove(
                "disabled"
            );
        }


        // Saklar 2 boleh memulai pengukuran

        if (switch2) {

            switch2.classList.remove(
                "disabled"
            );
        }
    }


    // -----------------------------------------------------
    // SAKLAR 1 = JALAN
    // -----------------------------------------------------

    else {

        // RC aktif

        rcButtons.forEach(
            button => {

                button.disabled = false;
            }
        );


        // RTB aktif

        if (rtbButton) {

            rtbButton.disabled = false;
        }


        // Saklar 1 aktif

        if (switch1) {

            switch1.classList.remove(
                "disabled"
            );
        }


        // Pengukuran tidak boleh dimulai

        if (switch2) {

            switch2.classList.add(
                "disabled"
            );
        }
    }
}


// =========================================================
// TOGGLE SAKLAR
// =========================================================

function toggleSwitch(number) {

    if (!radVAuthenticated) {
        return;
    }


    // =====================================================
    // SAKLAR 1
    // =====================================================

    if (number === 1) {

        if (measurementActive) {
            return;
        }


        const newState =
            switch1State === "STOP"
                ? "JALAN"
                : "STOP";


        const sent =
            sendMQTT(
                SWITCH1_TOPIC,
                newState
            );


        if (!sent) {

            console.warn(
                `Gagal mengirim Saklar 1: ${newState}`
            );

            return;
        }


        switch1State =
            newState;


        // Kalau pindah ke STOP,
        // pastikan kontrol RC dihentikan.

        if (newState === "STOP") {

            if (activeControl !== null) {

                sendMQTT(
                    CONTROL_TOPIC,
                    "STOP"
                );

                activeControl = null;
            }
        }


        updateSwitchDisplay();

        updateControlState();


        return;
    }


    // =====================================================
    // SAKLAR 2
    // =====================================================

    if (number === 2) {

        // Sedang mengukur → tekan lagi = SELESAI

        if (measurementActive) {

            finishMeasurement(
                "MANUAL"
            );

            return;
        }


        // Pengukuran hanya boleh saat Saklar 1 STOP

        if (switch1State !== "STOP") {

            console.warn(
                "Pengukuran hanya boleh dimulai saat Saklar 1 STOP."
            );

            return;
        }


        startMeasurement();
    }
}


// =========================================================
// UPDATE TAMPILAN SAKLAR
// =========================================================

function updateSwitchDisplay() {

    const switch1 =
        document.getElementById(
            "switch1"
        );


    const status1 =
        document.getElementById(
            "status1"
        );


    const switch2 =
        document.getElementById(
            "switch2"
        );


    const status2 =
        document.getElementById(
            "status2"
        );


    // =====================================================
    // SAKLAR 1
    // =====================================================

    if (switch1) {

        if (
            switch1State === "JALAN"
        ) {

            switch1.classList.add(
                "active"
            );

        } else {

            switch1.classList.remove(
                "active"
            );
        }
    }


    if (status1) {

        status1.textContent =
            switch1State;
    }


    // =====================================================
    // SAKLAR 2
    // =====================================================

    if (switch2) {

        if (
            switch2State === "MENGUKUR"
        ) {

            switch2.classList.add(
                "active"
            );

        } else {

            switch2.classList.remove(
                "active"
            );
        }
    }


    if (status2) {

        status2.textContent =
            switch2State;
    }
}


// =========================================================
// MULAI PENGUKURAN
// =========================================================

function startMeasurement() {

    // Jangan mulai jika sudah mengukur
    if (measurementActive) {
        return;
    }


    // Saklar 1 harus STOP
    if (switch1State !== "STOP") {

        console.warn(
            "Pengukuran hanya boleh dimulai saat Saklar 1 STOP."
        );

        return;
    }


    // MQTT wajib ONLINE
    if (
        !mqttClient ||
        !mqttClient.connected
    ) {

        console.warn(
            "Pengukuran gagal: MQTT OFFLINE."
        );

        return;
    }


    // =====================================================
    // KIRIM PERINTAH MENGUKUR KE ESP32
    // =====================================================

    const sent =
        sendMQTT(
            SWITCH2_TOPIC,
            "MENGUKUR"
        );


    if (!sent) {

        console.error(
            "Gagal mengirim MENGUKUR ke ESP32."
        );

        return;
    }


    // =====================================================
    // RESET SESI
    // =====================================================

   measurementActive = true;

const measurementPanel =
    document.getElementById(
        "measurementPanel"
    );

if (measurementPanel) {
    measurementPanel.classList.add("active");
}

measurementStartTime = Date.now();

switch2State = "MENGUKUR";


    // =====================================================
    // RESET TIMER
    // =====================================================

    clearTimeout(measurementTimer);
measurementTimer = null;

clearInterval(measurementClockTimer);
measurementClockTimer = null;


    // =====================================================
    // UPDATE TAMPILAN
    // =====================================================

    updateSwitchDisplay();

    updateMeasurementDisplay();

    updateControlState();


    // =====================================================
    // TIMER JAM
    // =====================================================

   measurementClockTimer =
    setInterval(
        function () {
            updateMeasurementClock();
        },
        1000
    );

   
    // =====================================================
    // TIMER MAKSIMAL 10 MENIT
    // =====================================================

    measurementTimer =
    setTimeout(
        function () {
            finishMeasurement("TIMEOUT");
        },
        MEASUREMENT_TOTAL_SECONDS * 1000
    );

    // Update pertama
    updateMeasurementClock();


    console.log(
        "RAD-V: Pengukuran dimulai"
    );
}



// =========================================================
// TERIMA DATA rc/data
// =========================================================

function handleMeasurementData(message) {

    console.log(
        "MQTT DATA:",
        message
    );

    let data;

    try {
        data = JSON.parse(message);
    } catch (error) {
        console.error(
            "JSON rc/data tidak valid:",
            error
        );
        return;
    }

    if (!measurementActive) {
        console.log(
            "Data diterima tetapi tidak ada sesi pengukuran aktif."
        );
        return;
    }

    updateSensorDisplay(data);

    const dataInfo =
        document.getElementById(
            "measurementDataInfo"
        );

    if (dataInfo) {
        dataInfo.textContent =
            `Data pengukuran diterima — CPM: ${
                Number(data.cpm || 0).toFixed(0)
            } — μSv/h: ${
                Number(data.usv || 0).toFixed(2)
            }`;
    }

    setTimeout(() => {

        if (
            typeof loadRadiationMap ===
            "function"
        ) {
            loadRadiationMap();
        }

    }, 3000);

    console.log(
        "RAD-V: Data pengukuran diterima",
        data
    );
}


// =========================================================
// UPDATE SENSOR
// =========================================================

function updateSensorDisplay(
    data
) {

    const cpmEl =
        document.getElementById(
            "cpm"
        );


    const usvEl =
        document.getElementById(
            "usv"
        );


    const latEl =
        document.getElementById(
            "latitude"
        );


    const lonEl =
        document.getElementById(
            "longitude"
        );


    // =====================================================
    // CPM
    // =====================================================

    if (
        cpmEl &&
        Number.isFinite(
            Number(data.cpm)
        )
    ) {

        cpmEl.textContent =
            Number(data.cpm).toFixed(0);
    }


    // =====================================================
    // uSv/h
    // =====================================================

    if (
        usvEl &&
        Number.isFinite(
            Number(data.usv)
        )
    ) {

        usvEl.textContent =
            Number(data.usv).toFixed(2);
    }


    // =====================================================
    // LATITUDE
    // =====================================================

    if (
        latEl &&
        Number.isFinite(
            Number(data.latitude)
        )
    ) {

        latEl.textContent =
            Number(data.latitude).toFixed(6);
    }


    // =====================================================
    // LONGITUDE
    // =====================================================

    if (
        lonEl &&
        Number.isFinite(
            Number(data.longitude)
        )
    ) {

        lonEl.textContent =
            Number(data.longitude).toFixed(6);
    }
}

// =========================================================
// UPDATE TIMER PENGUKURAN
// =========================================================

function updateMeasurementClock() {

    if (
        !measurementActive ||
        !measurementStartTime
    ) {
        return;
    }


    const elapsedSeconds =
        Math.floor(
            (
                Date.now() -
                measurementStartTime
            ) / 1000
        );


    const safeElapsed =
        Math.min(
            elapsedSeconds,
            MEASUREMENT_TOTAL_SECONDS
        );


    const minutes =
        Math.floor(
            safeElapsed / 60
        );


    const seconds =
        safeElapsed % 60;


    // =====================================================
    // TIMER
    // =====================================================

    const timer =
        document.getElementById(
            "measurementTimer"
        );


    if (timer) {

        timer.textContent =
            String(minutes).padStart(2, "0") +
            ":" +
            String(seconds).padStart(2, "0");
    }


    // =====================================================
    // PROGRESS BAR BERDASARKAN WAKTU
    // =====================================================

    const progressBar =
        document.getElementById(
            "measurementProgressBar"
        );


    if (progressBar) {

        const percentage =
            Math.min(
                (
                    safeElapsed /
                    MEASUREMENT_TOTAL_SECONDS
                ) * 100,
                100
            );

        progressBar.style.width =
            `${percentage}%`;
    }


    // =====================================================
    // DETAIL
    // =====================================================

    const detail =
        document.getElementById(
            "measurementDetail"
        );


    if (detail) {

        detail.textContent =
            "Pengukuran berlangsung selama 05:30.";
    }


    // =====================================================
    // TEXT PROGRESS
    // =====================================================

    const progressText =
        document.getElementById(
            "measurementProgressText"
        );


    if (progressText) {

        progressText.textContent =
            `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} / 05:30`;
    }
}

// =========================================================
// UPDATE TAMPILAN PROGRESS PENGUKURAN
// =========================================================

function updateMeasurementDisplay() {

    const status =
        document.getElementById(
            "measurementStatus"
        );

    const description =
        document.getElementById(
            "measurementDescription"
        );

    const dataInfo =
        document.getElementById(
            "measurementDataInfo"
        );

    if (status) {
        status.textContent =
            measurementActive
                ? "MENGUKUR"
                : "SELESAI";
    }

    if (measurementActive) {

        if (description) {
            description.textContent =
                "Pengukuran sedang berlangsung selama 05:30.";
        }

        if (dataInfo) {
            dataInfo.textContent =
                "Menunggu hasil pengukuran...";
        }

    } else {

        if (description) {
            description.textContent =
                "Aktifkan SENSOR untuk memulai pengukuran.";
        }

        if (dataInfo) {
            dataInfo.textContent =
                "Belum ada data pengukuran.";
        }
    }

    if (measurementActive) {
        updateMeasurementClock();
    }
}


// =========================================================
// SELESAI PENGUKURAN
// =========================================================

function finishMeasurement(reason) {

    if (!measurementActive) {
        return;
    }


    // Simpan waktu terakhir
    const finalElapsedSeconds =
        measurementStartTime
            ? Math.floor(
                (
                    Date.now() -
                    measurementStartTime
                ) / 1000
            )
            : 0;


    // =====================================================
    // STOP TIMER
    // =====================================================

    clearTimeout(
        measurementTimer
    );

    measurementTimer = null;


    clearInterval(
        measurementClockTimer
    );

    measurementClockTimer = null;


    // =====================================================
    // MATIKAN PENGUKURAN
    // =====================================================

    measurementActive = false;

const measurementPanel =
    document.getElementById(
        "measurementPanel"
    );

if (measurementPanel) {
    measurementPanel.classList.remove("active");
}
    
    measurementStartTime = null;

    switch2State =
        "SELESAI";


    // =====================================================
    // KIRIM SELESAI KE ESP32
    // =====================================================

    sendMQTT(
        SWITCH2_TOPIC,
        "SELESAI"
    );


    // =====================================================
    // UPDATE UI
    // =====================================================

    updateSwitchDisplay();

    updateMeasurementDisplay();

    updateControlState();


    // =====================================================
    // TIMER TERAKHIR
    // =====================================================

    const timerElement =
        document.getElementById(
            "measurementTimer"
        );


    if (timerElement) {

        const safeElapsed =
            Math.min(
                finalElapsedSeconds,
                MEASUREMENT_TOTAL_SECONDS
            );


        const minutes =
            Math.floor(
                safeElapsed / 60
            );


        const seconds =
            safeElapsed % 60;


        timerElement.textContent =
            String(minutes).padStart(2, "0") +
            ":" +
            String(seconds).padStart(2, "0");
    }


    // =====================================================
// PROGRESS TERAKHIR
// =====================================================

const progressBar =
    document.getElementById(
        "measurementProgressBar"
    );

if (progressBar) {

    const finalProgress =
        reason === "TIMEOUT"
            ? 100
            : Math.min(
                (
                    finalElapsedSeconds /
                    MEASUREMENT_TOTAL_SECONDS
                ) * 100,
                100
            );

    progressBar.style.width =
        `${finalProgress}%`;
}


const progressText =
    document.getElementById(
        "measurementProgressText"
    );


if (progressText) {

    const safeElapsed =
        Math.min(
            finalElapsedSeconds,
            MEASUREMENT_TOTAL_SECONDS
        );

    const minutes =
        Math.floor(
            safeElapsed / 60
        );

    const seconds =
        safeElapsed % 60;

    progressText.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} / 05:30`;
}


console.log(
    "RAD-V: Pengukuran selesai:",
    reason
);

}

// =========================================================
// KONTROL RC
// =========================================================

function pressControl(command, event) {

    if (event) {
        event.preventDefault();
    }

    if (!radVAuthenticated) {
        return false;
    }

    if (measurementActive) {
        return false;
    }

    if (switch1State !== "JALAN") {
        return false;
    }

    if (activeControl === command) {
        return true;
    }

    const sent =
        sendMQTT(
            CONTROL_TOPIC,
            command
        );

    if (!sent) {

        console.warn(
            "Perintah tidak terkirim:",
            command
        );

        return false;
    }

    activeControl =
        command;

    const buttons =
        document.querySelectorAll(
            ".control-button"
        );

    buttons.forEach(
        button => {

            button.classList.remove(
                "active"
            );
        }
    );

    if (event) {

        event.currentTarget.classList.add(
            "active"
        );
    }

    const commandDisplay =
        document.getElementById(
            "command"
        );

    if (commandDisplay) {

        commandDisplay.innerText =
            command;
    }

    return true;
}


// =========================================================
// LEPAS KONTROL RC
// =========================================================

function releaseControl(
    event
) {

    if (event) {

        event.preventDefault();
    }


    if (!radVAuthenticated) {

        return;
    }


    if (measurementActive) {

        return;
    }


    if (
        activeControl === null
    ) {

        return;
    }


  const sent =
    sendMQTT(
        CONTROL_TOPIC,
        "STOP"
    );

if (!sent) {

    console.error(
        "STOP gagal dikirim ke ESP32."
    );

    return;
}

activeControl =
    null;


    const buttons =
        document.querySelectorAll(
            ".control-button"
        );


    buttons.forEach(
        button => {

            button.classList.remove(
                "active"
            );
        }
    );


    const commandDisplay =
        document.getElementById(
            "command"
        );


    if (commandDisplay) {

        commandDisplay.innerText =
            "STOP";
    }
}


// =========================================================
// RTB
// =========================================================

function sendRTB() {

    if (!radVAuthenticated) {
        return false;
    }


    if (measurementActive) {
        return false;
    }


    if (switch1State !== "JALAN") {
        return false;
    }


    const sent =
        sendMQTT(
            CONTROL_TOPIC,
            "RTB"
        );


    if (!sent) {

        console.warn(
            "RTB gagal dikirim ke ESP32."
        );

        return false;
    }


    // Pastikan kontrol sebelumnya dilepas
    activeControl = null;


    const buttons =
        document.querySelectorAll(
            ".control-button"
        );


    buttons.forEach(
        button => {

            button.classList.remove(
                "active"
            );
        }
    );


    const commandDisplay =
        document.getElementById(
            "command"
        );


    if (commandDisplay) {

        commandDisplay.innerText =
            "RTB";
    }


    return true;
}


// =========================================================
// FUNGSI LAMA - TETAP KOMPATIBEL
// =========================================================

function switch1Jalan() {

    if (!radVAuthenticated) {
        return;
    }

    if (measurementActive) {
        return;
    }

    if (switch1State === "JALAN") {
        return;
    }

    const sent = sendMQTT(
        SWITCH1_TOPIC,
        "JALAN"
    );

    if (!sent) {
        console.warn(
            "Gagal mengirim JALAN ke ESP32."
        );
        return;
    }

    switch1State = "JALAN";

    updateSwitchDisplay();
    updateControlState();
}


function switch1Stop() {

    if (!radVAuthenticated) {
        return;
    }

    if (measurementActive) {
        return;
    }

    if (switch1State === "STOP") {
        return;
    }

    const sent = sendMQTT(
        SWITCH1_TOPIC,
        "STOP"
    );

    if (!sent) {
        console.warn(
            "Gagal mengirim STOP ke ESP32."
        );
        return;
    }

    switch1State = "STOP";

    if (activeControl !== null) {

        sendMQTT(
            CONTROL_TOPIC,
            "STOP"
        );

        activeControl = null;
    }

    updateSwitchDisplay();
    updateControlState();
}


function switch2Mengukur() {

    if (!radVAuthenticated) {
        return;
    }

    if (switch1State !== "STOP") {
        return;
    }

    if (!measurementActive) {
        startMeasurement();
    }
}


function switch2Selesai() {

    if (!radVAuthenticated) {
        return;
    }

    if (measurementActive) {
        finishMeasurement("MANUAL");
    }
}

// =========================================================
// KEYBOARD CONTROL RAD-V
// =========================================================

let keyboardControlActive = null;


// =========================================================
// PEMETAAN KEYBOARD
// =========================================================

const keyboardCommands = {

    KeyW: "MAJU",
    ArrowUp: "MAJU",

    KeyS: "MUNDUR",
    ArrowDown: "MUNDUR",

    KeyA: "KIRI",
    ArrowLeft: "KIRI",

    KeyD: "KANAN",
    ArrowRight: "KANAN"
};


// =========================================================
// KEY DOWN
// =========================================================

document.addEventListener(
    "keydown",
    function (event) {

        // =============================================
        // PIN HARUS SUDAH BENAR
        // =============================================

        if (!radVAuthenticated) {
            return;
        }


        // =============================================
        // JANGAN AKTIF SAAT MENGETIK
        // =============================================

        if (
            event.target.tagName === "INPUT" ||
            event.target.tagName === "TEXTAREA" ||
            event.target.tagName === "SELECT"
        ) {
            return;
        }


        // =============================================
        // RTB = R
        // =============================================

        if (event.code === "KeyR") {

            event.preventDefault();

            // Jangan kirim berulang
            if (event.repeat) {
                return;
            }

            // RTB menggunakan fungsi yang sudah ada
            sendRTB();

            console.log(
                "KEYBOARD: RTB"
            );

            return;
        }


        // =============================================
        // CARI PERINTAH
        // =============================================

        const command =
            keyboardCommands[event.code];


        if (!command) {
            return;
        }


        // =============================================
        // CEGAH BROWSER SCROLL
        // =============================================

        event.preventDefault();


        // =============================================
        // JANGAN ULANGI SAAT TOMBOL DITAHAN
        // =============================================

        if (event.repeat) {
            return;
        }


        // =============================================
        // CEK PENGUKURAN
        // =============================================

        if (measurementActive) {

            console.log(
                "KEYBOARD LOCK: sedang mengukur"
            );

            return;
        }


        // =============================================
        // SAKLAR 1 HARUS JALAN
        // =============================================

        if (
            switch1State !== "JALAN"
        ) {

            console.log(
                "KEYBOARD LOCK: Saklar 1 masih STOP"
            );

            return;
        }


        // =============================================
        // JIKA SUDAH ADA KONTROL AKTIF
        // =============================================

        if (
            keyboardControlActive !== null
        ) {

            return;
        }


        // =============================================
        // AKTIFKAN KONTROL
        // =============================================

       const activated =
    pressControl(
        command,
        null
    );


if (!activated) {
    return;
}


keyboardControlActive =
    command;


highlightKeyboardButton(
    command
);


console.log(
    "KEYBOARD:",
    command
);


        // =============================================
        // TAMPILKAN TOMBOL AKTIF
        // =============================================

        highlightKeyboardButton(
            command
        );


        console.log(
            "KEYBOARD:",
            command
        );
    }
);


// =========================================================
// KEY UP
// =========================================================

document.addEventListener(
    "keyup",
    function (event) {

        const command =
            keyboardCommands[event.code];


        if (!command) {
            return;
        }


        event.preventDefault();


        // =============================================
        // HANYA STOP KONTROL YANG SEDANG AKTIF
        // =============================================

        if (
            keyboardControlActive === command
        ) {

            releaseControl(null);

            keyboardControlActive =
                null;


            console.log(
                "KEYBOARD STOP:",
                command
            );
        }
    }
);



// =========================================================
// HIGHLIGHT TOMBOL
// =========================================================

function highlightKeyboardButton(
    command
) {

    const buttons =
        document.querySelectorAll(
            ".control-button"
        );


    buttons.forEach(
        button => {

            button.classList.remove(
                "active"
            );


            const text =
                button.innerText
                    .trim()
                    .toUpperCase();


            if (
                text.includes(command)
            ) {

                button.classList.add(
                    "active"
                );
            }
        }
    );
}


// =========================================================
// SAFETY STOP
// =========================================================

// Jika browser kehilangan fokus,
// kendaraan otomatis diperintahkan STOP.

window.addEventListener(
    "blur",
    function () {

        if (
            keyboardControlActive !== null
        ) {

            releaseControl(null);

            keyboardControlActive =
                null;
        }
    }
);


// =========================================================
// SAFETY STOP SAAT TAB TIDAK AKTIF
// =========================================================

document.addEventListener(
    "visibilitychange",
    function () {

        if (
            document.hidden &&
            keyboardControlActive !== null
        ) {

            releaseControl(null);

            keyboardControlActive =
                null;
        }
    }
);
