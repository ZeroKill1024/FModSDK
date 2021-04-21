/*==============================================================================
Effects Example
Copyright (c), Firelight Technologies Pty, Ltd 2004-2016.

This example shows how to apply some of the built in software effects to sounds
by applying them to the master channel group. All software sounds played here
would be filtered in the same way. To filter per channel, and not have other
channels affected, simply apply the same functions to the FMOD::Channel instead
of the FMOD::ChannelGroup.
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
var gSound;                             // Single sound that is to be played
var gChannel;                           // Last channel that is playing a sound.
var gDSPEffect = {};                    // Array of 4 effect handles.
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
    var fileUrl;
    var fileName;
    var folderName = "/";
    var canRead = true;
    var canWrite = false;

    fileUrl = "/public/js/drumloop.wav";
    fileName = "/drumloop.wav";
    FMOD.FS_createPreloadedFile(folderName, fileName, fileUrl, canRead, canWrite);
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

// Function called when user presses HTML Pause / Unpause button.
function pauseChannel()
{
    if (gChannel)
    {
        var result;
        var pausedOut = {};

        result = gChannel.getPaused(pausedOut);
        CHECK_RESULT(result);
        
        result = gChannel.setPaused(!pausedOut.val);
        CHECK_RESULT(result);
    }
}

// Function called from initApplication
function playSound()
{
    var channelOut = {};
    var result;
    
    result = gSystem.playSound(gSound, null, true, channelOut);
    CHECK_RESULT(result);

    gChannel = channelOut.val;
    
    result = gChannel.setPaused(false);
    CHECK_RESULT(result);
}

// Function called when user presses HTML Play Stream button
function toggleEffect(effectid)
{
    if (gDSPEffect[effectid])
    {
        var bypassout = {};

        result = gDSPEffect[effectid].getBypass(bypassout);
        CHECK_RESULT(result);

        result = gDSPEffect[effectid].setBypass(!bypassout.val);
        CHECK_RESULT(result);

        document.querySelector("#effects_out" + effectid).value = !bypassout.val ? "Off" : "On"; 
    }    
}

// Called from main, does some application setup.  In our case we will load some sounds.
function initApplication() 
{
    console.log("Loading sounds\n");

    // Create a sound that loops
    var soundOut = {};
    var effectOut = {};
    var result;
    
    result = gSystem.createStream("/drumloop.wav", FMOD.LOOP_NORMAL, null, soundOut);
    CHECK_RESULT(result);
    gSound = soundOut.val;

    playSound();

    // Create some effects to play with
    result = gSystem.createDSPByType(FMOD.DSP_TYPE_LOWPASS, effectOut);
    CHECK_RESULT(result);
    gDSPEffect[0] = effectOut.val;
    result = gSystem.createDSPByType(FMOD.DSP_TYPE_HIGHPASS, effectOut);
    CHECK_RESULT(result);
    gDSPEffect[1] = effectOut.val;
    result = gSystem.createDSPByType(FMOD.DSP_TYPE_ECHO, effectOut);
    CHECK_RESULT(result);
    gDSPEffect[2] = effectOut.val;
    result = gSystem.createDSPByType(FMOD.DSP_TYPE_FLANGE, effectOut);
    CHECK_RESULT(result);
    gDSPEffect[3] = effectOut.val;

    // Add them to the master channel group.  Each time an effect is added (to position 0) it pushes the others down the list.
    var mcgout = {};
    var mastergroup;
    
    result = gSystem.getMasterChannelGroup(mcgout);
    CHECK_RESULT(result);
    mastergroup = mcgout.val;

    for (var count = 0; count < 4; count++)
    {
        // By default, bypass all effects.  This means let the original signal go through without processing. It will sound 'dry' until effects are enabled by the user.
        result = gDSPEffect[count].setBypass(true);
        CHECK_RESULT(result);

        // add the dsp effect to the head of the master channelgroup bus.
        result = mastergroup.addDSP(FMOD.CHANNELCONTROL_DSP_HEAD, gDSPEffect[count]);
        CHECK_RESULT(result);
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
