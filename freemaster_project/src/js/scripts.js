/*
 * Copyright 2024 NXP
 *
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Created by Motion Control & Functional Safety Team, Roznov, Czechia
 */

// ================================================================================
//#region Variables
// ================================================================================

// JS Variables
var config = null;
const configurationFileName = "configuration.xml";
var isConfigValid = false;

const appLoopIntervalMs = 500;

// Elements
var eMessage = document.getElementById("eMessage");
var eInputToggleHelp = document.getElementById("eInputToggleHelp");
var eDivSectionApp = document.getElementById("eDivSectionApp");
var eDivSectionMeasurement = document.getElementById("eDivSectionMeasurement");
var eProgressMeasurement = document.getElementById("eProgressMeasurement");
var eProgressMeasurementCurrent = document.getElementById("eProgressMeasurementCurrent");
var eProgressMeasurementText = document.getElementById("eProgressMeasurementText");
var eInputSavingDestination = document.getElementById("eInputSavingDestination");
var eInputSavingName = document.getElementById("eInputSavingName");
var eInputSavingOffset = document.getElementById("eInputSavingOffset");
var eInputPreserveConfig = document.getElementById("eInputPreserveConfig");
var eButtonMeasurementControl = document.getElementById("eButtonMeasurementControl");
var eButtonMeasurementControlText = document.getElementById("eButtonMeasurementControlText");

var eMainContentHolder = document.getElementById("eMainContentHolder");
var eProgressBarMeasurementState = document.getElementById("eProgressBarMeasurementState");

var eAppStatus = document.getElementById("eAppStatus");
var eAppControl = document.getElementById("eAppControl");
var eButtonEmergencyStop = document.getElementById("eButtonEmergencyStop");

var eMeasurementStatus = document.getElementById("eMeasurementStatus");
var eSamplesStatus = document.getElementById("eSamplesStatus");
var eMeasuredCount = document.getElementById("eMeasuredCount");
var eToBeMeasuredCount = document.getElementById("eToBeMeasuredCount");

var eBtnConfSuccess = document.getElementById("eBtnConfSuccess");
var eBtnConfError = document.getElementById("eBtnConfError");
var eConfigTitleIcon = document.getElementById("eConfigTitleIcon");
var eConfigPreview = document.getElementById("eConfigPreview");


var finishedMeasurementCount = 0;

// C variables and getters/setters
var isMeasurementEnabled = 0;
function setIsMeasurementEnabled() { return pcm.WriteUIntVariable("mlud_status", 1, 1); }
function setIsRestartRequested() { return pcm.WriteUIntVariable("mlud_status", 1, 2); }

var progressTotal = 0;
function getTotalProgress() { return pcm.ReadUIntVariable("mlud_progressTotal"); }

var progressCurrent = 0;
function getCurrentProgress() { return pcm.ReadUIntVariable("mlud_progressCurrent"); }

// ================================================================================
//#endregion
// ================================================================================

// ================================================================================
//#region UI
// ================================================================================
function uiMsg(type, msg)
{
    if(type === null || type === false)
    {
        eMessage.style.display = "none";
        return;
    }
    
    eMessage.style.display = "block";

    switch (type)
    {
        case "w":
            eMessage.className = "alert alert-warning py-2";
            eMessage.innerHTML = "[WARNING]: " + msg;
            return;
        case "e":
            eMessage.className = "alert alert-danger py-2";
            eMessage.innerHTML = "[ERROR]: " + msg;
            return;
        case "i":
        default:
            eMessage.className = "alert alert-primary py-2";
            eMessage.innerHTML = "[INFO]: " + msg;
            return;
    }    
}

function uiLockWholeSections(status)
{
    if(status)
    {
        eDivSectionApp.classList.add("disabled-content");
        eDivSectionMeasurement.classList.add("disabled-content");
    }
    else
    {
        eDivSectionApp.classList.remove("disabled-content");
        eDivSectionMeasurement.classList.remove("disabled-content");
    }   
}

function uiInit()
{
    // Set window handlers
    addEventListener("resize", uiOnResize);

    // Initialize elements
    uiMsg(false);
    eInputSavingDestination.value = config.file.folder;
    eInputSavingName.value = config.file.prefix;
    eInputPreserveConfig.checked = config.isPreserved;

    // Clear both progress bars
    eProgressMeasurementCurrent.style.width = eProgressMeasurement.style.width = "0%";
    eProgressMeasurementCurrent.innerHTML = eProgressMeasurementText.innerHTML = "-";

    // Set element handlers
    eButtonMeasurementControl.onclick = function(event)
    {
        // Reset error state
        if(currentMeasurementState == MEASUREMENT_STATE_ERROR)
        {
            handleMeasurementState(MEASUREMENT_STATE_IDLE);
            return;
        }

        // Reset measurement
        if(currentMeasurementState == MEASUREMENT_STATE_IDLE)
        {
            handleMeasurementState(MEASUREMENT_STATE_INIT);
            return;
        }

        // Start measurement
        if(currentMeasurementState == MEASUREMENT_STATE_INIT)
        {
            handleMeasurementState(MEASUREMENT_STATE_START);
            return;
        }
    };

    eInputSavingOffset.oninput = function(event)
    {
        eInputSavingOffset.value = padWithZeros(eInputSavingOffset.value < 0 ? 0 : eInputSavingOffset.value);
        config.file.offset = eInputSavingOffset.value;
        eInputSavingOffset.dispatchEvent(new Event('change', { bubbles: true }));    
    }
    uiUpdateOffsetValue(config.file.offset);

    eButtonEmergencyStop.onclick = function(event)
    {
        toggleApplicationControl(false);
        handleMeasurementState(MEASUREMENT_STATE_ERROR);
    }

    eInputPreserveConfig.onchange = function(event)
    {
        config.isPreserved = eInputPreserveConfig.checked;
        updateConfigurationFile();
    }

    eInputSavingDestination.title = eInputSavingDestination.value;
    eInputSavingDestination.onchange = function(event)
    {
        eInputSavingDestination.title = eInputSavingDestination.value;
        config.file.folder = eInputSavingDestination.value;
        updateConfigurationFile();
    }

    eInputSavingName.title = eInputSavingName.value;
    eInputSavingName.onchange = function(event)
    {
        eInputSavingName.title = eInputSavingName.value;
        config.file.prefix = eInputSavingName.value;
        updateConfigurationFile();
    }

    eInputSavingOffset.onchange = function(event)
    {
        config.file.offset = Number(eInputSavingOffset.value);
        updateConfigurationFile();
    }

    eInputToggleHelp.onchange = function(event)
    {
        var helps = document.getElementsByClassName("app-help");
        for(var i = 0; i < helps.length; i++)
        {
            helps[i].style.display = eInputToggleHelp.checked ? "inline-block" : "none";
        }
    }

    // Configuration panel
    eBtnConfError.style.display = isConfigValid ? "none" : "block";
    eBtnConfSuccess.style.display = !isConfigValid ? "none" : "block";
    eConfigTitleIcon.className = isConfigValid ? "fa-solid fa-circle-check text-success" : "fa-solid fa-circle-xmark text-danger";

    eConfigPreview.appendChild(uiCreateConfigPreviewTitle("Application control"));
    eConfigPreview.appendChild(uiCreateConfigPreviewElement("State variable", (config.app.stateVariable != null) ? config.app.stateVariable.symbol : "-", (config.app.stateVariable != null) ? (config.app.stateVariable.address !== undefined) : true));
    eConfigPreview.appendChild(uiCreateConfigPreviewElement("Control variable", (config.app.controlVariable != null) ? config.app.controlVariable.symbol : "-", (config.app.controlVariable != null) ? (config.app.controlVariable.address !== undefined) : true));
    eConfigPreview.appendChild(uiCreateConfigPreviewElement("Start delay (ms)", config.app.startDelayMs, config.app.startDelayMs !== undefined));

    eConfigPreview.appendChild(uiCreateConfigPreviewTitle("Start sequence"));
    if(config.app.startSequence.length == 0) { eConfigPreview.appendChild(uiCreateConfigPreviewText("No variables included")); }
    for (let i = 0; i < config.app.startSequence.length; i++) 
    {
        const variable = config.app.startSequence[i];
        eConfigPreview.appendChild(uiCreateConfigPreviewValue(variable.symbol, variable.value, variable.address !== undefined));
    }

    eConfigPreview.appendChild(uiCreateConfigPreviewTitle("Stop sequence"));
    if(config.app.stopSequence.length == 0) { eConfigPreview.appendChild(uiCreateConfigPreviewText("No variables included")); }
    for (let i = 0; i < config.app.stopSequence.length; i++) 
    {
        const variable = config.app.stopSequence[i];
        eConfigPreview.appendChild(uiCreateConfigPreviewValue(variable.symbol, variable.value, variable.address !== undefined));
    }
    
    eConfigPreview.appendChild(uiCreateConfigPreviewTitle("Measurement variables"));
    if(config.measurement.variables.length == 0) { eConfigPreview.appendChild(uiCreateConfigPreviewText("No variables included")); }
    for (let i = 0; i < config.measurement.variables.length; i++) 
    {
        const variable = config.measurement.variables[i];
        eConfigPreview.appendChild(uiCreateConfigPreviewValue(variable.symbol, variable.name, variable.address !== undefined));
    }

    if(!isConfigValid)
    {
        uiToggleMainContent(false);
        uiMsg("e", "Configuration is not valid! Fix it (based on information under blinking button above on right) and refresh the page.");
    }

    uiCreateStepProgress(0);
}

function uiToggleMainContent(isVisible)
{
    eMainContentHolder.style.display = isVisible ? "block" : "none";
}

function uiCreateConfigPreviewElement(label, value, status)
{
    /* <div class="input-group mb-3">
        <div class="form-floating flex-grow-1">
            <input type="text" class="form-control" readonly>
            <label>State variable</label>
        </div>
        <span class="input-group-text">
            <i class="fa-solid fa-circle-xmark text-danger"></i>
        </span>
    </div> */

    var div = document.createElement("div");
    div.className = "input-group mb-3";
    div.innerHTML = 
        '<div class="form-floating flex-grow-1">' +
            '<input type="text" class="form-control" value="' + value + '" readonly>' +
            '<label>' + label + '</label>' +
        '</div>' +
        '<span class="input-group-text" ' + (status ? "" : 'title="Symbol or variable is not found!"') + '>' +
            '<i class="fa-solid ' + (status ? "fa-circle-check text-success" : "fa-circle-xmark text-danger") + '"></i>' +
        '</span>'; 
    
    return div;
}

function uiCreateConfigPreviewValue(label, value, status)
{
    var div = document.createElement("div");
        div.className = "input-group mb-3";
        div.innerHTML = 
                '<input type="text" class="form-control" value="' + label + '" readonly>' +
                '<span class="input-group-text">' + value + '</span>' +
                '<span class="input-group-text" ' + (status ? "" : 'title="Symbol or variable is not found!"') + '>' +
                    '<i class="fa-solid ' + (status ? "fa-circle-check text-success" : "fa-circle-xmark text-danger") + '"></i>' +
                '</span>';
    
    return div;
}

function uiCreateConfigPreviewTitle(text)
{
    var p = document.createElement("p");
    p.innerHTML = '<strong>' + text + '</strong>';
    return p;
}

function uiCreateConfigPreviewText(text)
{
    var p = document.createElement("p");
    p.innerHTML = '<small>' + text + '</small>';
    return p;
}

function uiUpdateOffsetValue(newValue)
{
    eInputSavingOffset.value = newValue;
    eInputSavingOffset.dispatchEvent(new Event('input', { bubbles: true }));
}

function uiLock(status)
{
    [eInputSavingDestination, eInputSavingName, eInputSavingOffset, eToBeMeasuredCount, eButtonMeasurementControl]
    .forEach(element => 
    {
        if(status)
        {
            element.setAttribute("disabled", "");
        }
        else
        {
            element.removeAttribute("disabled");
        }
    });    
}

function uiUpdateProgress()
{       
    eProgressMeasurement.style.width = (finishedMeasurementCount / Number.parseInt(eToBeMeasuredCount.value) * 100) + "%";
    eProgressMeasurement.innerHTML = finishedMeasurementCount + " / " + eToBeMeasuredCount.value;
    eMeasuredCount.value = finishedMeasurementCount;
    
    eProgressMeasurementCurrent.style.width = (progressCurrent / progressTotal * 100) + "%";
    eProgressMeasurementCurrent.innerHTML = progressCurrent + " / " + progressTotal;
    eSamplesStatus.innerHTML = progressCurrent + " / " + progressTotal;
}

function uiRefresh()
{
    // Reset error state
    if(currentMeasurementState == MEASUREMENT_STATE_ERROR)
    {
        eButtonMeasurementControlText.innerHTML = "Reset error state";
    }
    
    // Reset measurement
    if(currentMeasurementState == MEASUREMENT_STATE_IDLE)
    {
        eButtonMeasurementControlText.innerHTML = "Restart measurement";
    }

    // Start measurement
    if(currentMeasurementState == MEASUREMENT_STATE_INIT)
    {
        eButtonMeasurementControlText.innerHTML = "Start measurement";
    }

    // Start measurement
    if(currentMeasurementState == MEASUREMENT_STATE_IN_PROGRESS)
    {
        eButtonMeasurementControlText.innerHTML = "Measurement is in progress...";
    }

    // Update UI
    eMeasurementStatus.innerHTML = currentMeasurementState;
    uiUpdateProgress();
}

function uiCreateStepProgress(currentState, inProgress = true)
{
    stepIcons = ["fas fa-play", "far fa-hourglass-half", "fa fa-chart-line", "fas fa-file-signature", "fas fa-reply-all", "fas fa-stop"];
    stepTitles = ["Measurement start", "Start delay", "Measurement is in progress", "Writing data to file", "Restart before new measurement", "All measurements are done"];
    steps = "";

    for (let index = 0; index < stepIcons.length; index++)
    {
        var suffix = "idle";
        if(index == currentState)
        {
            suffix = inProgress ? "in-progress" : "done";
        }
        else if(index < currentState)
        {
            suffix = "done";
        }

        // Add line
        if (index > 0)
        {
            steps += '<span class="line-' + suffix + '"></span>';
        }

        // Add step
        var isSpinnerRequired = (inProgress && index == currentState);
        steps += '<div title="' + stepTitles[index] + '" class="step-' + suffix + '">';
        if(isSpinnerRequired)
        {
            steps += '<div class="spinner-border" role="status"></div>';
        }        
        steps += '<span ' + (isSpinnerRequired ? "style=\"position:absolute\"" : "") + '><i class="' + stepIcons[index] + '"></i></span></div>';
    }

    // Add error step
    steps += '<span class="line-dashed"></span>';
    steps += '<div title="Application was stopped or is in fault state" class="' + ((currentState < 0) ? "step-error glow-danger" : "step-idle") + '"><span><i class="fas fa-triangle-exclamation"></i></span></div>';

    eProgressBarMeasurementState.innerHTML = steps;
}

function uiOnResize(event)
{
    // Not necessary to handle. :)
}

// ================================================================================
//#endregion
// ================================================================================

// ================================================================================
//#region Measurement state machine
// ================================================================================
const MEASUREMENT_STATE_IDLE = "MEASUREMENT_STATE_IDLE";
const MEASUREMENT_STATE_INIT = "MEASUREMENT_STATE_INIT";
const MEASUREMENT_STATE_START = "MEASUREMENT_STATE_START";
const MEASUREMENT_STATE_IN_PROGRESS = "MEASUREMENT_STATE_IN_PROGRESS";
const MEASUREMENT_STATE_FINISHED = "MEASUREMENT_STATE_FINISHED";
const MEASUREMENT_STATE_COMPLETE = "MEASUREMENT_STATE_COMPLETE";
const MEASUREMENT_STATE_ERROR = "MEASUREMENT_STATE_ERROR";

var currentMeasurementState = MEASUREMENT_STATE_IDLE;
var currentlyRequestedMeasurementState = null;

const TransitionTable = 
{
    MEASUREMENT_STATE_IDLE: 
    {
        MEASUREMENT_STATE_INIT: transitionIdleToMeasurementInit
    },
    MEASUREMENT_STATE_INIT: 
    {
        MEASUREMENT_STATE_START: transitionMeasurementInitToMeasurementStart
    },
    MEASUREMENT_STATE_START: 
    {
        MEASUREMENT_STATE_IN_PROGRESS: transitionMeasurementStartToMeasurementInProgress
    },
    MEASUREMENT_STATE_IN_PROGRESS: 
    {
        MEASUREMENT_STATE_FINISHED: transitionMeasurementInProgressToMeasurementFinished
    },
    MEASUREMENT_STATE_FINISHED: 
    {
        MEASUREMENT_STATE_INIT: transitionMeasurementFinishedToMeasurementInit,
        MEASUREMENT_STATE_COMPLETE: transitionMeasurementFinishedToMeasurementComplete
    },
    MEASUREMENT_STATE_COMPLETE: 
    {
        MEASUREMENT_STATE_IDLE: transitionMeasurementCompleteToIdle
    },
    MEASUREMENT_STATE_ERROR:
    {
        MEASUREMENT_STATE_IDLE: transitionErrorToIdle
    }
};

function handleMeasurementState(newState)
{
    log("STATE_CHANGE_REQUEST: " + currentMeasurementState + " -> " + newState);
    currentlyRequestedMeasurementState = newState;
    
    // If state transition is supported
    if(TransitionTable[currentMeasurementState].hasOwnProperty(newState))
    {
        // If transition was successful
        if(TransitionTable[currentMeasurementState][newState]())
        {
            log("STATE_CHANGED: " + currentMeasurementState + " -> " + newState);
            currentMeasurementState = newState;
            currentlyRequestedMeasurementState = null;
            return;
        }
    }

    // Error otherwise
    log("STATE_CHANGE_ERROR: " + currentMeasurementState + " -> " + MEASUREMENT_STATE_ERROR);
    transitionError();
    currentMeasurementState = MEASUREMENT_STATE_ERROR;
    currentlyRequestedMeasurementState = null;
}

async function transitionIdleToMeasurementInit()
{
    // Clear measured data
    finishedMeasurementCount = 0;
    progressCurrent = 0;
    uiCreateStepProgress(0);

    // Request restart of all parameters before next measurement
    return await setIsRestartRequested().then(() => true).catch(() => false);
}

async function transitionMeasurementInitToMeasurementStart()
{
    // Lock UI
    uiLock(true);
    uiCreateStepProgress(1);

    // Request reset of measurement
    await setIsRestartRequested();

    // Start app
    if(toggleApplicationControl(true))    
    {
        // If app starting was successful -> wait a while and continue
        setTimeout(() => { handleMeasurementState(MEASUREMENT_STATE_IN_PROGRESS); }, config.app.startDelayMs);
        return true;
    }

    return false;
}

async function transitionMeasurementStartToMeasurementInProgress()
{
    progressCurrent = 0;
    uiCreateStepProgress(2);

    // Enable measurement on chip again before new one
    return await setIsMeasurementEnabled().then(() => true).catch(() => false);
}

async function transitionMeasurementInProgressToMeasurementFinished()
{
    uiCreateStepProgress(3);

    // Stop app here (Data are measured)
    if(toggleApplicationControl(false))
    {
        // Try to update UI first (JS and UI is blocked by data download then)
        if(await requesApplicationStatus())
        {
            if(config.measurement.variables.length > 0)
            {
                // Download all variables
                log("Reading variables...");
                for (let index = 0; index < config.measurement.variables.length; index++)
                {
                    if(config.measurement.variables[index].read)
                    {
                        config.measurement.variables[index].data = await config.measurement.variables[index].read().then((response) => { log("Variable \"" + config.measurement.variables[index].symbol + "\" downloaded!"); return response.data; }).catch((err) => { log("Variable \"" + config.measurement.variables[index].symbol + "\" was not downloaded!", "ERROR"); return null; });
                    }
                }

                // Convert to string
                log("Converting variables to text file...");

                var content = "";
                var firstColIndex = null;
                var maxRows = 0;

                // Prepare header
                for (let index = 0; index < config.measurement.variables.length; index++)
                {
                    if(config.measurement.variables[index].data != null)
                    {
                        // Find maximum
                        if(config.measurement.variables[index].type.length > maxRows) { maxRows = config.measurement.variables[index].type.length; }

                        // Add prepend tabulator (except for first column)
                        if(firstColIndex == null) { firstColIndex = index; }
                        if(index != firstColIndex) { content += "\t"; }

                        // Add value name
                        content += config.measurement.variables[index].name;
                    }
                }
                // Do not add new line here and do it prepend for each row

                // Add all values
                for (let row = 0; row < maxRows; row++)
                {
                    content += "\n";
                    for (let col = firstColIndex; col < config.measurement.variables.length; col++)
                    {
                        // Add prepend tabulator (except for first column)
                        if(col != firstColIndex) { content += "\t"; }

                        // If value exist at row
                        if(config.measurement.variables[col].data != null)
                        {
                            if(config.measurement.variables[col].type.length > 1)
                            {
                                if(row < config.measurement.variables[col].type.length)
                                {
                                    // Add to string
                                    content += config.measurement.variables[col].data[row].toString();
                                }
                            }
                            else
                            {
                                // Add variable only at first row
                                if(row == 0)
                                {
                                    // Add to string
                                    content += config.measurement.variables[col].data.toString();
                                }
                            }
                        }
                    }
                }

                // Save results to file
                log("Saving variables to file...");
                fileName = eInputSavingDestination.value + "\\" + eInputSavingName.value + padWithZeros(Number.parseInt(eInputSavingOffset.value) + finishedMeasurementCount) + ".csv";
                    
                saveToFile(fileName, content);
                log("Saved to \"" + fileName + "\".");
            }
            else
            {
                log("Nothing to save...");
            }
            
            finishedMeasurementCount++;
                
            // Invoke state change after small time
            setTimeout(() => 
            {
                if(finishedMeasurementCount < Number.parseInt(eToBeMeasuredCount.value))
                {
                    handleMeasurementState(MEASUREMENT_STATE_INIT);
                }
                else
                {
                    handleMeasurementState(MEASUREMENT_STATE_COMPLETE);
                }   
            }, 50);
        
            return true;
        }
    }

    return false;
}

async function transitionMeasurementFinishedToMeasurementInit()
{
    uiCreateStepProgress(4);

    // Invoke state change after small time
    setTimeout(() => 
    {
        // Reset current measurement
        handleMeasurementState(MEASUREMENT_STATE_START);  
    }, 50);
    return true;
}

async function transitionMeasurementFinishedToMeasurementComplete()
{
    uiCreateStepProgress(5);

    uiUpdateOffsetValue(Number.parseInt(eInputSavingOffset.value) + finishedMeasurementCount);

    // Invoke state change after small time
    setTimeout(() => 
    {
        // Continue to end
        handleMeasurementState(MEASUREMENT_STATE_IDLE);
    }, 50);
    return true;
}

async function transitionMeasurementCompleteToIdle()
{
    uiCreateStepProgress(6);

    // Unlock UI
    uiLock(false);
    return true;
}

async function transitionErrorToIdle()
{
    uiCreateStepProgress(0);

    // Unlock UI
    uiLock(false);
    return true;
}

async function transitionError()
{
    uiCreateStepProgress(-1);

    // Force app to stop
    toggleApplicationControl(false);

    // Unlock UI
    uiLock(false);

    return true;
}
// ================================================================================
//#endregion
// ================================================================================

// ================================================================================
//#region Measurement
// ================================================================================

async function requestMeasurementStatus()
{
    return await getCurrentProgress().then((response) => 
    {
        progressCurrent = response.data;
        return true;
    })
    .catch((err) =>
    {
        console.log(err);
        return false;
    }); 
}

// ================================================================================
//#endregion
// ================================================================================

// ================================================================================
//#region Configuration file and symbols control
// ================================================================================

function getSymbolManipulationFunctions(variable)
{
    if(variable.type)
    {
        switch (variable.type.name)
        {
            case "uint8":
            case "uint16":
            case "uint32":
            case "uint64":
            {
                if (variable.type.length > 1)
                {
                    return [
                        function() { return pcm.ReadUIntArray(variable.symbol, variable.type.length, variable.type.size); },
                        function(value) { return pcm.WriteUIntArray(variable.symbol, variable.type.length, variable.type.size, value); }
                    ];
                }
                else
                {
                    return [
                        function() { return pcm.ReadUIntVariable(variable.symbol, variable.type.size); },
                        function(value) { return pcm.WriteUIntVariable(variable.symbol, variable.type.size, value); }
                    ];
                }
            }
        
            case "int8":
            case "int16":
            case "int32":
            case "int64":
            {
                if (variable.type.length > 1)
                {
                    return [
                        function() { return pcm.ReadIntArray(variable.symbol, variable.type.length, variable.type.size); },                        
                        function(value) { return pcm.WriteIntArray(variable.symbol, variable.type.length, variable.type.size, value); }
                    ];
                }
                else
                {
                    return [
                        function() { return pcm.ReadIntVariable(variable.symbol, variable.type.size); },
                        function(value) { return pcm.WriteIntVariable(variable.symbol, variable.type.size, value); }
                    ];
                }
            }
            
            case "float":
            {
                if (variable.type.length > 1)
                {
                    return [
                        function() { return pcm.ReadFloatArray(variable.symbol, variable.type.length); },
                        function(value) { return pcm.ReadFloatArray(variable.symbol, variable.type.length, value); }
                    ];
                }
                else
                {
                    return [
                        function() { return pcm.ReadFloatVariable(variable.symbol); },
                        function(value) { return pcm.ReadFloatVariable(variable.symbol, value); }
                    ];
                }
            }
            
            case "double":
            {
                if (variable.type.length > 1)
                {
                    return [
                        function() { return pcm.ReadDoubleArray(variable.symbol, variable.type.length); },
                        function(value) { return pcm.ReadDoubleArray(variable.symbol, variable.type.length, value); }
                    ];
                }
                else
                {
                    return [
                        function() { return pcm.ReadDoubleVariable(variable.symbol); },
                        function(value) { return pcm.ReadDoubleVariable(variable.symbol, value); }
                    ];
                }
            }                    
        } 
    }

    return [null, null];
}

async function getSymbolType(variable)
{
    if(variable.frmType == "float")
    {
        return { name: "float", size: 4, signed: true, length: variable.frmSize / 4 };
    }
    
    if(variable.frmType == "double")
    {
        return { name: "double", size: 8, signed: true, length: variable.frmSize / 8 };
    }
    
    if(variable.frmType.includes("long") || variable.frmType.includes("int") || variable.frmType.includes("char"))
    {
        var type = { name: "", size: 1, signed: true, length: 1 };

        if(variable.frmType.includes("unsigned"))
        {
            type.name = "uint";
            type.signed = false;
        }
        else
        {
            type.name = "int";
        }

        if(variable.frmType.includes("char"))
        {
            type.name += "8";
            type.size = 1;
        }
        else if(variable.frmType.includes("long long"))
        {
            type.name += "64";
            type.size = 8;
        }
        else if(variable.frmType.includes("int") && variable.frmType.includes("short"))
        {
            type.name += "16";
            type.size = 2;
        }
        else
        {
            type.name += "32";
            type.size = 4;
        }

        type.length = variable.frmSize / type.size;

        return type;
    }

    // Probably enum - Try parse its definition
    var result = await pcm.GetEnumDefinition(variable.frmType).then((response) => response).catch((err) => null);
    if(result)
    {
        var values = {};
        for (let index = 0; index < result.xtra.def.items.length; index++)
        {
            const item = result.xtra.def.items[index];
            values[item.value_min] = item.name;
        }

        return { name: "int" + (variable.frmSize * 8).toString(), size: variable.frmSize, signed: true, length: 1, enum: values };
    }

    // It is custom datatype we dont know
    return { name: "unknown", size: variable.frmSize, signed: false, length: 1 };
    // return { name: "uint" + (variable.frmSize * 8).toString(), size: variable.frmSize, signed: false, length: 1 };
}

async function initializeConfiguration()
{
    // Prepare temporary array of all variables
    var variables = [].concat(config.app.startSequence, config.app.stopSequence, config.measurement.variables);

    if (config.app.stateVariable) { variables = variables.concat(config.app.stateVariable); }
    if (config.app.controlVariable) { variables = variables.concat(config.app.controlVariable); }


    var isAnyError = false;

    log("\t - Loading info about all variables and symbols used in application...");
    for (let index = 0; index < variables.length; index++)
    {
        let variable = variables[index];
        
        // Parameter is C variable
        var result = await pcm.GetSymbolInfo(variable.symbol).then((response) => response).catch((err) => null);
        if(result)
        {
            variable.address = result.xtra.addr;
            variable.frmType = result.xtra.type;
            variable.frmSize = result.xtra.size;
            variable.type = await getSymbolType(variable);
            variable.data = []; // Prepare pointer for data value/s
            [variable.read, variable.write] = getSymbolManipulationFunctions(variable);
            variable.readSync = async function() { await variable.read().then((res) => res.data).catch((err) => null); };
            variable.writeSync = async function(value) { await variable.write(value).then((res) => true).catch((err) => false); };

            log("\t\t - Symbol info about \"" + variable.symbol + "\" was successfuly loaded!");
            continue;
        }

        // Parameter is FreeMASTER variable
        result = await pcm.GetVariableInfo(variable.symbol).then((response) => response).catch((err) => null);
        if(result)
        {
            variable.address = null;
            variable.read = function() { return pcm.ReadVariable(variable.symbol); };
            variable.readSync = async function() { await variable.read().then((res) => res.data).catch((err) => null); };
            variable.write = async function(value) { await pcm.WriteVariable(variable.symbol, value); };
            variable.writeSync = async function(value) { await variable.write(value).then((res) => true).catch((err) => false); };
            log("\t\t - Variable info about \"" + variable.symbol + "\" was successfuly loaded!");
            continue;
        }

        log("\t\t - Variable or symbol info about \"" + variable.symbol + "\" was NOT loaded!", "ERROR");
        isAnyError = true;
    }
    log("\t - Loading of info about all variables and symbols used in application was finished!");
    return !isAnyError;
}

async function saveConfigFile()
{
    var handle = await pcm.LocalFileOpen(configurationFileName, "w").then((res) => res.data).catch((err) => false);

    if(handle)
    {        
        await pcm.LocalFileWriteString(handle, toXML(config));
        await pcm.LocalFileClose(handle);
        return true;
    }
    return false;
}

async function loadConfigFile()
{
    var handle = await pcm.LocalFileOpen(configurationFileName, "r").then((res) => res.data).catch((err) => false);

    // Default
    var conf = null;    

    if(handle)
    {
        var r = await pcm.LocalFileReadString(handle);
        await pcm.LocalFileClose(handle);

        conf = fromXML(r.data);
    }

    if(!conf)
    {
        conf = 
        {
            isPreserved: true,
            // File parameters
            file:
            {
                folder: "measured_data",
                prefix: "my_measurement_",
                offset: 1,
                paddingZerosCount: 6
            },
        
            // Application parameters
            app:
            {
                startSequence:
                [
                ],
                stopSequence:
                [
                ],
                startDelayMs: 0,
            },
        
            // Measurement parameters
            measurement:
            {
                variables:
                [
                ]
            }
        };
    }

    return conf;
}

function updateConfigurationFile()
{
    if(config.isPreserved)
    {
        saveConfigFile();
    }
}

// ================================================================================
//#endregion
// ================================================================================

// ================================================================================
//#region App
// ================================================================================
async function appSetup()
{
    log("ML Universal Datalogger app started!", "INFO", "font-weight:bold;");
    
    log("Initializing configuration...", "INFO", "font-weight:bold;");
    // Load or create config file
    log("\t - Loading configuration file...");
    config = await loadConfigFile(true);
    log("\t - Configuration file loaded!");

    // Prepare variables and other config parameters
    isConfigValid = await initializeConfiguration();
    log("Configuration initialization finished!", "INFO", "font-weight:bold;");

    // Initialize UI
    uiInit();

    if(isConfigValid)
    {
        // Load current state of application
        getTotalProgress().then((response) => 
        {
            progressTotal = response.data;
            requesApplicationStatus();
            requestMeasurementStatus();
            handleMeasurementState(MEASUREMENT_STATE_INIT);
        })
        .catch((err) =>
        {
            console.log(err);
        });
    }
}

function appLoop()
{
    if(isConfigValid)
    {
        // Is prepared?
        pcm.IsCommPortOpen().then((res) => 
        {
            if(res.data)
            {
                uiMsg(false);
                uiToggleMainContent(true);
                uiLockWholeSections(false);
                requesApplicationStatus();
                requestMeasurementStatus();
            }
            else
            {
                uiMsg("e", "Communication is not open!");
                uiToggleMainContent(false);
                uiLockWholeSections(true);
            }
        }).catch((err) => 
        {
            uiMsg("e", "Communication is not open!");
            uiLockWholeSections(true);
        });
        uiRefresh();
    
        if(currentMeasurementState == MEASUREMENT_STATE_IN_PROGRESS && currentlyRequestedMeasurementState != MEASUREMENT_STATE_FINISHED)
        {
            if (progressCurrent == progressTotal)        
            {
                handleMeasurementState(MEASUREMENT_STATE_FINISHED);
            }
        }
    }    
}

// ================================================================================
//#endregion
// ================================================================================

// ================================================================================
//#region Application Control handling
// ================================================================================
async function applicationStart()
{
    for (let index = 0; index < config.app.startSequence.length; index++)
    {
        config.app.startSequence[index].writeSync(config.app.startSequence[index].value);
    }
    return true;
}

async function applicationStop()
{
    for (let index = 0; index < config.app.stopSequence.length; index++)
    {
        config.app.stopSequence[index].writeSync(config.app.stopSequence[index].value);
    }
    return true;
}

async function requesApplicationStatus()
{
    if(config.app.stateVariable)
    {
        if(!await config.app.stateVariable.read().then((response) => 
        {
            handleMotorControlStatus(response.data);
            return true;
        })
        .catch((err) =>
        {
            console.log(err);
            return false;
        }))
        {
            return false;
        }
    }    

    if(config.app.controlVariable)
    {
        if(!await config.app.controlVariable.read().then((response) => 
        {
            eAppControl.innerHTML = "(" + Math.round(response.data) + " " + config.app.controlVariable.unit + ")";
            return true;
        })
        .catch((err) =>
        {
            console.log(err);
            return false;
        }))
        {
            return false;
        }
    }    
    
    return true;
}

function handleMotorControlStatus(status)
{
    eAppStatus.innerHTML = ("enum" in config.app.stateVariable.type) ? config.app.stateVariable.type.enum[status]: status;
    eAppStatus.className = (status == config.app.stateVariable.faultValue) ? "badge bg-danger" : "badge bg-info";
}

function toggleApplicationControl(enabled)
{
    return !enabled ? applicationStop() : applicationStart();
}

// ================================================================================
//#endregion
// ================================================================================

// ================================================================================
//#region Helpers
// ================================================================================

async function saveToFile(fileName, data)
{
    var fileHandle = null;
    await pcm.LocalFileOpen(fileName, 'w').then((response) => fileHandle = response.data);

    if(fileHandle)
    {
        if(await pcm.LocalFileWriteString(fileHandle, data).then((response) => true).catch((err) => false).finally(() => pcm.LocalFileClose(fileHandle)))
        {
            return true;
        }
    }
    return false;
}

function padWithZeros(input)
{
    return ("0".repeat(config.file.paddingZerosCount) + input.toString()).slice(-config.file.paddingZerosCount);
}

function getFormattedDate()
{
    var date = new Date();

    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hour = date.getHours();
    var min = date.getMinutes();
    var sec = date.getSeconds();
    var msec = date.getMilliseconds();

    month = (month < 10 ? "0" : "") + month;
    day = (day < 10 ? "0" : "") + day;
    hour = (hour < 10 ? "0" : "") + hour;
    min = (min < 10 ? "0" : "") + min;
    sec = (sec < 10 ? "0" : "") + sec;
    msec = (msec < 10 ? "00" : msec < 100 ? "0" : "") + msec;

    return date.getFullYear() + "-" + month + "-" + day + "_" +  hour + ":" + min + ":" + sec + "." + msec;
}

function getFormattedTime()
{
    var date = new Date();

    var hour = date.getHours();
    var min = date.getMinutes();
    var sec = date.getSeconds();
    var msec = date.getMilliseconds();

    hour = (hour < 10 ? "0" : "") + hour;
    min = (min < 10 ? "0" : "") + min;
    sec = (sec < 10 ? "0" : "") + sec;
    msec = (msec < 10 ? "00" : msec < 100 ? "0" : "") + msec;

    return hour + ":" + min + ":" + sec + "." + msec;
}

function log(msg, type = null, style = null)
{
    if(type)
    {
        if(type == "ERROR")
        {
            console.error("[" + getFormattedTime() + "][" + type + "] " + msg);
            return;            
        }

        console.log("%c [" + getFormattedTime() + "][" + type + "] " + msg, style ? style : "");
    }
    else
    {
        console.log("%c [" + getFormattedTime() + "][INFO] " + msg, style ? style : "");
    }
    //console.trace("[" + getFormattedTime() + "] " + msg);
}

function parseXMLVariableArray(xmlObj, xmlName, arr)
{
    var tt = xmlObj.querySelector(xmlName).querySelectorAll("variable");
    for (let index = 0; index < tt.length; index++)
    {
        var el = { symbol: tt[index].attributes["symbol"].nodeValue };

        if(tt[index].hasAttribute("value"))
        {
            var val = tt[index].attributes["value"].nodeValue;
            el.value = Number(val) !== NaN ? Number(val) : val
        }
        
        if(tt[index].hasAttribute("name"))
        {
            el.name = tt[index].attributes["name"].nodeValue
        }

        arr.push(el);
    }
}

function fromXML(xmlString)
{
    var xml = (new DOMParser()).parseFromString(xmlString, "text/xml");

    try 
    {
        var conf = { file:{}, app:{}, measurement: {}};

        conf.isPreserved = true;
        
        // File
        var t = xml.querySelector("configuration").querySelector("file");
        conf.file.folder = t.querySelector("folder").attributes["value"].nodeValue;
        conf.file.prefix = t.querySelector("prefix").attributes["value"].nodeValue;
        conf.file.offset = Number(t.querySelector("offset").attributes["value"].nodeValue);
        conf.file.paddingZerosCount = Number(t.querySelector("paddingZerosCount").attributes["value"].nodeValue);
        
        // App
        var t = xml.querySelector("configuration").querySelector("app");
        conf.app.stateVariable = t.querySelector("stateVariable") ? { symbol: t.querySelector("stateVariable").attributes["symbol"].nodeValue, faultValue: t.querySelector("stateVariable").attributes["faultValue"].nodeValue} : null;
        conf.app.controlVariable = t.querySelector("controlVariable") ? { symbol: t.querySelector("controlVariable").attributes["symbol"].nodeValue, unit: t.querySelector("controlVariable").attributes["unit"].nodeValue} : null;
        parseXMLVariableArray(t, "startSequence", conf.app.startSequence = []);
        parseXMLVariableArray(t, "stopSequence", conf.app.stopSequence = []);
        conf.app.startDelayMs = Number(t.querySelector("startDelayMs").attributes["value"].nodeValue);

        // Measurement
        var t = xml.querySelector("configuration").querySelector("measurement");
        parseXMLVariableArray(t, "variables", conf.measurement.variables = []);

        return conf;
    } catch (err)
    {
        console.log(err);
    }
    return null;
}

function toXML(json)
{
    try 
    {
        var xml = new Document();
        xml.appendChild(xml.createElement("configuration"));
        
        // File
        xml.documentElement.append(xml.createComment("File export"));
        var t = xml.documentElement.appendChild(xml.createElement("file"));
        t.appendChild(xml.createElement("folder")).setAttribute("value", json.file.folder);
        t.appendChild(xml.createElement("prefix")).setAttribute("value", json.file.prefix);
        t.appendChild(xml.createElement("offset")).setAttribute("value", json.file.offset);
        t.appendChild(xml.createElement("paddingZerosCount")).setAttribute("value", json.file.paddingZerosCount);
    
        // App
        xml.documentElement.append(xml.createComment("Application control"));
        var t = xml.documentElement.appendChild(xml.createElement("app"));

        if(json.app.stateVariable != null)
        {
            t.append(xml.createComment("Variable containing the application status"));
            var tt =  t.appendChild(xml.createElement("stateVariable"));
            tt.setAttribute("symbol", json.app.stateVariable.symbol);
            tt.setAttribute("faultValue", json.app.stateVariable.faultValue);
        }
        
        if(json.app.controlVariable != null)
        {
            t.append(xml.createComment("Variable containing the actual control value (e.g. speed of motor)"));
            var tt = t.appendChild(xml.createElement("controlVariable"));
            tt.setAttribute("symbol", json.app.controlVariable.symbol);
            tt.setAttribute("unit", json.app.controlVariable.unit);
        }
        
        t.append(xml.createComment("Variables and their values to be executed in order to start application"));
        var tt = t.appendChild(xml.createElement("startSequence"));
        for (let index = 0; index < json.app.startSequence.length; index++)
        {
            var v = tt.appendChild(xml.createElement("variable"));
            v.setAttribute("symbol", json.app.startSequence[index].symbol);
            v.setAttribute("value", json.app.startSequence[index].value);
        }

        t.append(xml.createComment("Variables and their values to be executed in order to stop application"));
        var tt = t.appendChild(xml.createElement("stopSequence"));
        for (let index = 0; index < json.app.stopSequence.length; index++)
        {
            var v = tt.appendChild(xml.createElement("variable"));
            v.setAttribute("symbol", json.app.stopSequence[index].symbol);
            v.setAttribute("value", json.app.stopSequence[index].value);
        }

        t.append(xml.createComment("Delay between application start and beginning of measurement"));
        t.appendChild(xml.createElement("startDelayMs")).setAttribute("value", json.app.startDelayMs);
    
        // Measurement
        xml.documentElement.append(xml.createComment("Measurement control"));
        var t = xml.documentElement.appendChild(xml.createElement("measurement"));
        t.append(xml.createComment("Variables to be downloaded and their name in CSV file"));
        var tt = t.appendChild(xml.createElement("variables"));
        for (let index = 0; index < json.measurement.variables.length; index++)
        {
            var v = tt.appendChild(xml.createElement("variable"));
            v.setAttribute("symbol", json.measurement.variables[index].symbol);
            v.setAttribute("name", json.measurement.variables[index].name);
        }
        return prettifyXml(xml.documentElement.outerHTML);
    } catch (err)
    {
        console.log(err);
    }

    return null;
}

var prettifyXml = function(sourceXml)
{
    var xmlDoc = new DOMParser().parseFromString(sourceXml, 'application/xml');
    var xsltDoc = new DOMParser().parseFromString([
        '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">',
        '  <xsl:strip-space elements="*"/>',
        '  <xsl:template match="para[content-style][not(text())]">',
        '    <xsl:value-of select="normalize-space(.)"/>',
        '  </xsl:template>',
        '  <xsl:template match="node()|@*">',
        '    <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>',
        '  </xsl:template>',
        '  <xsl:output indent="yes"/>',
        '</xsl:stylesheet>',
    ].join('\n'), 'application/xml');

    var xsltProcessor = new XSLTProcessor();    
    xsltProcessor.importStylesheet(xsltDoc);
    var resultDoc = xsltProcessor.transformToDocument(xmlDoc);
    var resultXml = new XMLSerializer().serializeToString(resultDoc);
    return resultXml;
};
// ================================================================================
//#endregion
// ================================================================================

// ================================================================================
//#region Main entrypoint
// ================================================================================
function main()
{
    // Initialize FreeMASTER
    pcm = new PCM("localhost:41000",
        function()
        {
            //console.log("onSocketConnected")
            appSetup();
            setInterval(appLoop, appLoopIntervalMs);
        }, 
        function(err)
        {
            //console.log("onSocketClosed")
            console.log(err)
        }, 
        function()
        {            
            //console.log("onSocketError")
            console.log(err)
        });
}
// ================================================================================
//#endregion
// ================================================================================

