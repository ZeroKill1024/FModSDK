/*==============================================================================
Generate Tone Example
Copyright (c), Firelight Technologies Pty, Ltd 2004-2016.

This example shows how to play generated tones using System::playDSP
instead of manually connecting and disconnecting DSP units.
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
var gChannel;                           // Channel handle that is playing a DSP.
var gDSP;                               // handle to oscillator DSP effect.
var gAudioResumed  = false;             // Boolean to avoid resetting FMOD on IOS/Chrome every time screen is touched.

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
    /* No sounds to load! */   
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

function ButtonPressed(button)
{
    var outval = {};

    if (button == "sine")
    {
        if (gChannel)
        {
            result = gChannel.stop();
            CHECK_RESULT(result);
        }

        result = gSystem.playDSP(gDSP, null, true, outval);
        CHECK_RESULT(result);
        gChannel = outval.val;

        result = gChannel.setVolume(0.5);
        CHECK_RESULT(result);
        result = gDSP.setParameterInt(FMOD.DSP_OSCILLATOR_TYPE, 0);
        CHECK_RESULT(result);
        result = gChannel.setPaused(false);
        CHECK_RESULT(result);

        document.querySelector("#volume").value = 0.5;
        document.querySelector("#volume_out").value = 0.5;
        document.querySelector("#frequency_out").value = 48000;
    }
    else if (button == "square")
    {
        if (gChannel)
        {
            result = gChannel.stop();
            CHECK_RESULT(result);
        }

        result = gSystem.playDSP(gDSP, null, true, outval);
        CHECK_RESULT(result);
        gChannel = outval.val;

        result = gChannel.setVolume(0.125);
        CHECK_RESULT(result);
        result = gDSP.setParameterInt(FMOD.DSP_OSCILLATOR_TYPE, 1);
        CHECK_RESULT(result);
        result = gChannel.setPaused(false);
        CHECK_RESULT(result);

        document.querySelector("#volume").value = 0.125;
        document.querySelector("#volume_out").value = 0.125;
        document.querySelector("#frequency_out").value = 48000;
    }
    else if (button == "saw")
    {
        if (gChannel)
        {
            result = gChannel.stop();
            CHECK_RESULT(result);
        }

        result = gSystem.playDSP(gDSP, null, true, outval);
        CHECK_RESULT(result);
        gChannel = outval.val;

        result = gChannel.setVolume(0.125);
        CHECK_RESULT(result);
        result = gDSP.setParameterInt(FMOD.DSP_OSCILLATOR_TYPE, 2);
        CHECK_RESULT(result);
        result = gChannel.setPaused(false);
        CHECK_RESULT(result);

        document.querySelector("#volume").value = 0.125;
        document.querySelector("#volume_out").value = 0.125;
        document.querySelector("#frequency_out").value = 48000;
    }
    else if (button == "triangle")
    {
        if (gChannel)
        {
            result = gChannel.stop();
            CHECK_RESULT(result);
        }

        result = gSystem.playDSP(gDSP, null, true, outval);
        CHECK_RESULT(result);
        gChannel = outval.val;
        
        result = gChannel.setVolume(0.5);
        CHECK_RESULT(result);
        result = gDSP.setParameterInt(FMOD.DSP_OSCILLATOR_TYPE, 4);
        CHECK_RESULT(result);
        result = gChannel.setPaused(false);
        CHECK_RESULT(result);

        document.querySelector("#volume").value = 0.5;
        document.querySelector("#volume_out").value = 0.5;
        document.querySelector("#frequency_out").value = 48000;
    }
    else if (button == "stop")
    {
        if (gChannel)
        {
            result = gChannel.stop();
            CHECK_RESULT(result);
            gChannel = null;
        }
    }
}

// Function called when user drags HTML range slider.
function volumeChanged(val)
{
    document.querySelector("#volume_out").value = val;

    if (gChannel)
    {
        var result = gChannel.setVolume(parseFloat(val));
        CHECK_RESULT(result);
    }
}
// Function called when user drags HTML range slider.
function frequencyChanged(val)
{
    document.querySelector("#frequency_out").value = val;

    if (gChannel)
    {
        var result = gChannel.setFrequency(parseFloat(val));
        CHECK_RESULT(result);
    }
}


// Called from main, does some application setup.  In our case we will load some sounds.
function initApplication() 
{
    console.log("Loading sounds\n");

    var outval = {};
    var result;

    /*
        Create an oscillator DSP units for the tone.
    */
    result = gSystem.createDSPByType(FMOD.DSP_TYPE_OSCILLATOR, outval);
    CHECK_RESULT(result);
    gDSP = outval.val;

    result = gDSP.setParameterFloat(FMOD.DSP_OSCILLATOR_RATE, 440.0); /* Musical note 'A' */
    CHECK_RESULT(result);
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
