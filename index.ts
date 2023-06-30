import "@wokwi/elements";
import { buildHex } from "./compile";
import { AVRRunner } from "./execute";
import { formatTime } from "./format-time";
import { LEDElement } from "@wokwi/elements";
import "./index.css";

const BLINK_CODE = `
// LEDs connected to pins 11..13

byte leds[] = {13, 12, 11};
void setup() {
  Serial.begin(115200);
  for (byte i = 0; i < sizeof(leds); i++) {
    pinMode(leds[i], OUTPUT);
  }
}

int i = 0;
void loop() {
  Serial.print("LED: ");
  Serial.println(i);
  digitalWrite(leds[i], HIGH);
  delay(250);
  digitalWrite(leds[i], LOW);
  i = (i + 1) % sizeof(leds);
}`.trim();

let editor;
declare const window: any;
declare const monaco: any;
window.editorLoaded = () => {
  window.require.config({
    paths: {
      vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.21.2/min/vs"
    }
  });
  window.require(["vs/editor/editor.main"], () => {
    editor = monaco.editor.create(document.querySelector(".code-editor"), {
      value: BLINK_CODE,
      language: "cpp",
      minimap: { enabled: false }
    });
  });
};

// Set up LEDs
const LEDs = document.querySelectorAll<LEDElement & HTMLElement>("wokwi-led");

// Set up toolbar
let runner: AVRRunner;

const runButton = document.querySelector("#run-button");
runButton.addEventListener("click", compileAndRun);
const stopButton = document.querySelector("#stop-button");
stopButton.addEventListener("click", stopCode);
const statusLabel = document.querySelector("#status-label");
const compilerOutputText = document.querySelector<HTMLElement>(
  "#compiler-output-text"
);

function executeProgram(hex: string) {
  runner = new AVRRunner(hex);

  // Hook to PORTB register
  runner.portB.addListener(value => {
    for (const led of LEDs) {
      const pin = parseInt(led.getAttribute("pin"), 10);
      led.value = value & (1 << (pin - 8)) ? true : false;
    }
  });

  // Serial port output support
  runner.usart.onByteTransmit = (value: number) => {
    if (compilerOutputText.style.color !== "blue") {
      compilerOutputText.style.color = "blue";
      compilerOutputText.innerText = "";
    }
    compilerOutputText.textContent += String.fromCharCode(value);
  };

  runner.execute(cpu => {
    const time = formatTime(cpu.cycles / runner.MHZ);
    statusLabel.textContent = "Simulation time: " + time;
  });
}

async function compileAndRun() {
  for (const led of LEDs) {
    led.value = false;
  }

  runButton.setAttribute("disabled", "1");
  try {
    statusLabel.textContent = "Compiling...";
    const result = await buildHex(editor.getModel().getValue());
    compilerOutputText.style.color = "";
    compilerOutputText.textContent = result.stderr || result.stdout;
    if (result.hex) {
      compilerOutputText.textContent += "\nProgram running...";
      stopButton.removeAttribute("disabled");
      executeProgram(result.hex);
    } else {
      runButton.removeAttribute("disabled");
    }
  } catch (err) {
    runButton.removeAttribute("disabled");
    alert("Failed: " + err);
  } finally {
    statusLabel.textContent = "";
  }
}

function stopCode() {
  stopButton.setAttribute("disabled", "1");
  runButton.removeAttribute("disabled");
  if (runner) {
    runner.stop();
    runner = null;
  }
}
