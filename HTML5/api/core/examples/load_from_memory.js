/*==============================================================================
Load From Memory Example
Copyright (c), Firelight Technologies Pty, Ltd 2004-2016.

This example is simply a variant of the [Play Sound Example](play_sound.html), 
but it loads the data into memory then uses the 'load from memory' feature of 
System::createSound.
==============================================================================*/

//==============================================================================
// Prerequisite code needed to set up FMOD object.  See documentation.
//==============================================================================

var FMOD = {};                          // FMOD global object which must be declared to enable 'main' and 'preRun' and then call the constructor function.
FMOD['preRun'] = prerun;                // Will be called before FMOD runs, but after the Emscripten runtime has initialized
FMOD['onRuntimeInitialized'] = main;    // Called when the Emscripten runtime has initialized
FMOD['INITIAL_MEMORY'] = 64*1024*1024;  // FMOD Heap defaults to 16mb which may be enough for this demo, but set it differently here for demonstration (64mb)
FMODModule(FMOD);                       // Calling the constructor function with our object


//==============================================================================
// Example code
//==============================================================================

var gSystem;                            // Global 'System' object which has the top level API functions.  Sounds and channels are created from this.
var gSound;                             // Sound playing.
var gChannel;                           // Last channel that is playing a sound.
var gEffects;                           // boolean to toggle effects on or off
var gDSP;                               // handle to reverb DSP effect.
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

function handleFileSelect(evt) 
{
    var reader = new FileReader();
    reader.onload = function (e) 
    {
        // Create a sound that loops
        var chars  = new Uint8Array(e.target.result);
        var outval = {};
        var result;
        var exinfo = FMOD.CREATESOUNDEXINFO();
        exinfo.length = chars.length;

        if (gSound)
        {
            gSound.release();
        }

        result = gSystem.createSound(chars.buffer, FMOD.LOOP_OFF | FMOD.OPENMEMORY, exinfo, outval);
        CHECK_RESULT(result);
        gSound = outval.val;

        // Free the original memory as it's no longer needed, if loading as a stream the memory must remain until the Sound is stopped
        delete chars.buffer;
        delete chars;
    };
    reader.onerror = function (e) 
    {
        console.error(e);
    };
    reader.readAsArrayBuffer(evt.target.files[0]);

    delete reader;
}

function playSound()
{
    if (gSound)
    {
        var outval = {}, result;

        result = gSystem.playSound(gSound, null, false, outval);
        CHECK_RESULT(result);
        gChannel = outval.val;
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

// Function called when user presses HTML stop all sounds button.
function stopAll()
{
    var mcgout = {};
    var result;
    
    result = gSystem.getMasterChannelGroup(mcgout);
    CHECK_RESULT(result);

    var mcg = mcgout.val;
    result = mcg.stop();
    CHECK_RESULT(result);
}

// Function called when user presses HTML toggle effects button.
function toggleEffects()
{
    var channelGroupOut = {};
    var channelGroup;
    var result;

    result = gSystem.getMasterChannelGroup(channelGroupOut);
    CHECK_RESULT(result);

    channelGroup = channelGroupOut.val;

    if (!gDSP)
    {
        // Create the Reverb DSP
        var dspOut = {}
        result = gSystem.createDSPByType(FMOD.DSP_TYPE_SFXREVERB, dspOut);
        CHECK_RESULT(result);

        gDSP = dspOut.val;

        // Adjust some parameters of the DSP
        result = gDSP.setParameterFloat(FMOD.DSP_SFXREVERB_DECAYTIME, 5000.0);
        result = gDSP.setParameterFloat(FMOD.DSP_SFXREVERB_WETLEVEL, -3.0);
        result = gDSP.setParameterFloat(FMOD.DSP_SFXREVERB_DRYLEVEL, -2.0);
        CHECK_RESULT(result);

        // Add the DSP to the channel
        result = channelGroup.addDSP(FMOD.CHANNELCONTROL_DSP_TAIL, gDSP);
        CHECK_RESULT(result);

        document.querySelector("#effects_out").value = "On";
    }
    else
    {
        result = channelGroup.removeDSP(gDSP);
        CHECK_RESULT(result);

        gDSP.release();
        gDSP = null;

        document.querySelector("#effects_out").value = "Off";
    }
}

// Called from main, does some application setup.  In our case we will load some sounds.
function initApplication() 
{
     document.getElementById('file').addEventListener('change', handleFileSelect, false);    
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
