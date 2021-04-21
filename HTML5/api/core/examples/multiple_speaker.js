/*==============================================================================
Multiple Speaker Example
Copyright (c), Firelight Technologies Pty, Ltd 2004-2016.

This example shows how to play sounds in multiple speakers, and also how to even
assign sound subchannels, such as those in a stereo sound to different
individual speakers.
==============================================================================*/

//==============================================================================
// Prerequisite code needed to set up FMOD object.  See documentation.
//==============================================================================

var FMOD = {};                          // FMOD global object which must be declared to enable 'main' and 'preRun' and then call the constructor function.
FMOD['preRun'] = prerun;                // Will be called before FMOD runs, but after the Emscripten runtime has initialized
FMOD['onRuntimeInitialized'] = main;    // Called when the Emscripten runtime has initialized
FMOD['INITIAL_MEMORY'] = 64*1024*1024;  // FMOD Heap defaults to 16mb which is enough for this demo, but set it differently here for demonstration (64mb)
FMODModule(FMOD);                       // Calling the constructor function with our object

//==============================================================================
// Example code
//==============================================================================

var gSystem;                            // Global 'System' object which has the top level API functions.  Sounds and channels are created from this.
var gSound = {};                        // Array of 2 sounds.
var gChannel;                           // Last channel that is playing a sound.
var gSpeakerMode;                       // System speaker mode.
var gAudioResumed  = false;             // Boolean to avoid resetting FMOD on IOS/Chrome every time screen is touched.

var SPEAKERMODE_STRING = [ "default", "raw", "mono", "stereo", "quad", "surround", "5.1", "7.1" ];

// Simple error checking function for all FMOD return values.
function CHECK_RESULT(result)
{
    if (result != FMOD.OK)
    {
        var msg = "Error!!! '" + FMOD.ErrorString(result) + "'";

        alert(msg);

        throw msg;
    }
}

// Will be called before FMOD runs, but after the Emscripten runtime has initialized
// Call FMOD file preloading functions here to mount local files.  Otherwise load custom data from memory or use own file system. 
function prerun() 
{
    var fileUrl = "/public/js/";
    var fileName;
    var folderName = "/";
    var canRead = true;
    var canWrite = false;

    fileName = [
        "drumloop.wav",
        "stereo.mp3",
    ];

    for (var count = 0; count < fileName.length; count++)
    {
        FMOD.FS_createPreloadedFile(folderName, fileName[count], fileUrl + fileName[count], canRead, canWrite);
    }    
}

// Called when the Emscripten runtime has initialized
function main()
{
    // A temporary empty object to hold our system
    var systemOut = {};
    var result;

    console.log("Creating FMOD System object\n");

    // Create the system and check the result
    result = FMOD.System_Create(systemOut);
    CHECK_RESULT(result);

    console.log("grabbing system object from temporary and storing it\n");

    // Take out our System object
    gSystem = systemOut.val;

    // Optional.  Setting DSP Buffer size can affect latency and stability.
    // Processing is currently done in the main thread so anything lower than 2048 samples can cause stuttering on some devices.
    console.log("set DSP Buffer size.\n");
    result = gSystem.setDSPBufferSize(2048, 2);
    CHECK_RESULT(result);

    console.log("set speaker mode.\n");
    result = gSystem.setSoftwareFormat(48000, FMOD.SPEAKERMODE_5POINT1, 0);
    CHECK_RESULT(result);

    console.log("initialize FMOD\n");

    // 1024 virtual channels
    result = gSystem.init(1024, FMOD.INIT_NORMAL, null);
    CHECK_RESULT(result);

    console.log("initialize Application\n");
    initApplication();

    // Set up iOS/Chrome workaround.  Webaudio is not allowed to start unless screen is touched or button is clicked.
    function resumeAudio() 
    {
        if (!gAudioResumed)
        {
            console.log("Resetting audio driver based on user input.");

            result = gSystem.mixerSuspend();
            CHECK_RESULT(result);
            result = gSystem.mixerResume();
            CHECK_RESULT(result);

            gAudioResumed = true;
        }
    }

    var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (iOS)
    {
        window.addEventListener('touchend', resumeAudio, false);
    }
    else
    {
        document.addEventListener('click', resumeAudio);
    }

    // Starting up your typical JavaScript application loop. Set the framerate to 50 frames per second, or 20ms.
    console.log("Start game loop\n");
    window.setInterval(updateApplication, 20);

    return FMOD.OK;
}

function isSelectionAvailable(mode, selection)
{
    if (mode == FMOD.SPEAKERMODE_MONO || mode == FMOD.SPEAKERMODE_STEREO)
    {
        if (selection == 2 || selection == 3 || selection == 4 || selection == 5 || selection == 6 || selection == 9) return false;
    }
    else if (mode == FMOD.SPEAKERMODE_QUAD)
    {
        if (selection == 2 || selection == 5 || selection == 6 || selection == 9) return false;
    }
    else if (mode == FMOD.SPEAKERMODE_SURROUND || mode == FMOD.SPEAKERMODE_5POINT1)
    {
        if (selection == 5 || selection == 6) return false;
    }

    return true;
}


function onButtonPress(selection)
{
    var outval = {};
    var result;

    if (isSelectionAvailable(gSpeakerMode, selection))
    {
        if (selection == 0) /* Mono front left */
        {
            result = gSystem.playSound(gSound[0], null, true, outval);
            CHECK_RESULT(result);
            gChannel = outval.val;

            result = gChannel.setMixLevelsOutput(1.0, 0, 0, 0, 0, 0, 0, 0);
            CHECK_RESULT(result);

            result = gChannel.setPaused(false);
            CHECK_RESULT(result);
        }
        else if (selection == 1) /* Mono front right */
        {
            result = gSystem.playSound(gSound[0], null, true, outval);
            CHECK_RESULT(result);
            gChannel = outval.val;

            result = gChannel.setMixLevelsOutput(0, 1.0, 0, 0, 0, 0, 0, 0);
            CHECK_RESULT(result);

            result = gChannel.setPaused(false);
            CHECK_RESULT(result);
        }
        else if (selection == 2) /* Mono center */
        {
            result = gSystem.playSound(gSound[0], null, true, outval);
            CHECK_RESULT(result);
            gChannel = outval.val;

            result = gChannel.setMixLevelsOutput(0, 0, 1.0, 0, 0, 0, 0, 0);
            CHECK_RESULT(result);

            result = gChannel.setPaused(false);
            CHECK_RESULT(result);
        }
        else if (selection == 3) /* Mono surround left */
        {
            result = gSystem.playSound(gSound[0], null, true, outval);
            CHECK_RESULT(result);
            gChannel = outval.val;

            result = gChannel.setMixLevelsOutput(0, 0, 0, 0, 1.0, 0, 0, 0);
            CHECK_RESULT(result);

            result = gChannel.setPaused(false);
            CHECK_RESULT(result);
        }
        else if (selection == 4) /* Mono surround right */
        {
            result = gSystem.playSound(gSound[0], null, true, outval);
            CHECK_RESULT(result);
            gChannel = outval.val;

            result = gChannel.setMixLevelsOutput(0, 0, 0, 0, 0, 1.0, 0, 0);
            CHECK_RESULT(result);

            result = gChannel.setPaused(false);
            CHECK_RESULT(result);
        }
        else if (selection == 5) /* Mono rear left */
        {
            result = gSystem.playSound(gSound[0], null, true, outval);
            CHECK_RESULT(result);
            gChannel = outval.val;

            result = gChannel.setMixLevelsOutput(0, 0, 0, 0, 0, 0, 1.0, 0);
            CHECK_RESULT(result);

            result = gChannel.setPaused(false);
            CHECK_RESULT(result);
        }
        else if (selection == 6) /* Mono rear right */
        {
            result = gSystem.playSound(gSound[0], null, true, outval);
            CHECK_RESULT(result);
            gChannel = outval.val;

            result = gChannel.setMixLevelsOutput(0, 0, 0, 0, 0, 0, 0, 1.0);
            CHECK_RESULT(result);

            result = gChannel.setPaused(false);
            CHECK_RESULT(result);
        }
        else if (selection == 7) /* Stereo front */
        {
            result = gSystem.playSound(gSound[1], null, false, outval);
            CHECK_RESULT(result);
            gChannel = outval.val;

        }
        else if (selection == 8) /* Stereo front channel swapped */
        {
            var matrix = [ 0.0, 1.0, 1.0, 0.0 ];

            result = gSystem.playSound(gSound[1], null, true, outval);
            CHECK_RESULT(result);
            gChannel = outval.val;

            result = gChannel.setMixMatrix(matrix, 2, 2, 0);
            CHECK_RESULT(result);

            result = gChannel.setPaused(false);
            CHECK_RESULT(result);
        }
        else if (selection == 9) /* Stereo (right only) center */
        {
            var matrix = [ 0.0, 0.0, 0.0, 0.0, 0.0, 1.0 ];

            result = gSystem.playSound(gSound[1], null, true, outval);
            CHECK_RESULT(result);
            gChannel = outval.val;

            result = gChannel.setMixMatrix(matrix, 3, 2, 0);
            CHECK_RESULT(result);

            result = gChannel.setPaused(false);
            CHECK_RESULT(result);
        }
    }
}

// Called from main, does some application setup.  In our case we will load some sounds.
function initApplication() 
{
    var outval = {}

    console.log("Loading sounds\n");

    // Create a sound that loops
    result = gSystem.getSoftwareFormat(null, outval, null);
    CHECK_RESULT(result);

    gSpeakerMode = outval.val;

    result = gSystem.createSound("/drumloop.wav", FMOD._2D | FMOD.LOOP_OFF, 0, outval);
    CHECK_RESULT(result);
    gSound[0] = outval.val;

    result = gSystem.createSound("/stereo.mp3", FMOD._2D | FMOD.LOOP_OFF,  0, outval);
    CHECK_RESULT(result);
    gSound[1] = outval.val;

    document.querySelector("#speakermode").value = SPEAKERMODE_STRING[gSpeakerMode]; 

    for (count = 0; count < 10; count++)
    {
        if (!isSelectionAvailable(gSpeakerMode, count))
        {
            document.getElementById("soundtype_" + count).style.textDecoration = "line-through";
            document.getElementById("button_" + count).disabled = true; 
        }
    }
}

// Called from main, on an interval that updates at a regular rate (like in a game loop).
// Prints out information, about the system, and importantly calles System::udpate().
function updateApplication() 
{
    var dsp = {};
    var stream = {};
    var update = {};
    var total = {};
    var result;
    
    result = gSystem.getCPUUsage(dsp, stream, null, update, total);
    CHECK_RESULT(result);

    var channelsplaying = {};
    result = gSystem.getChannelsPlaying(channelsplaying, null);
    CHECK_RESULT(result);

    document.querySelector("#display_out").value = "Channels Playing = " + channelsplaying.val + 
                                                   " : CPU = dsp " + dsp.val.toFixed(2) + 
                                                   "% stream " + stream.val.toFixed(2) + 
                                                   "% update " + update.val.toFixed(2) + 
                                                   "% total " + total.val.toFixed(2) + 
                                                   "%";
    var numbuffers = {};
    var buffersize = {};
    result = gSystem.getDSPBufferSize(buffersize, numbuffers);
    CHECK_RESULT(result) 

    var rate = {};
    result = gSystem.getSoftwareFormat(rate, null, null);
    CHECK_RESULT(result);

    var sysrate = {};
    result = gSystem.getDriverInfo(0, null, null, sysrate, null, null);
    CHECK_RESULT(result);
    
    var ms = numbuffers.val * buffersize.val * 1000 / rate.val;
    document.querySelector("#display_out2").value = "Mixer rate = " + rate.val + "hz : System rate = " + sysrate.val + "hz : DSP buffer size = " + numbuffers.val + " buffers of " + buffersize.val + " samples (" + ms.toFixed(2) + " ms)";

    // Update FMOD
    result = gSystem.update();
    CHECK_RESULT(result);
}
