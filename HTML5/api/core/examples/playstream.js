/*==============================================================================
Play Stream Example
Copyright (c), Firelight Technologies Pty, Ltd 2004-2016.

This example shows how to simply play a stream such as an MP3 or WAV. The stream
behaviour is achieved by specifying FMOD_CREATESTREAM in the call to 
System::createSound. This makes FMOD decode the file in realtime as it plays,
instead of loading it all at once which uses far less memory in exchange for a
small runtime CPU hit.
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
var gSound;                             // Single sound to be played.
var gChannel;                           // Last channel that is playing a sound.
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

    fileUrl = "/public/js/wave.mp3";
    fileName = "/wave.mp3";
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

    // Starting up your typical JavaScript application loop
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

    console.log("Start game loop\n");

    window.setInterval(updateApplication, 20);

    return FMOD.OK;
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

// Function called when user presses HTML stop stream  button.
function stopChannel()
{
    if (gChannel)
    {
        var result;
        result = gChannel.stop();
        CHECK_RESULT(result);

        delete gChannel;
        gChannel = null;
    }
}

// Function called when user presses HTML Play Stream button
function playSound()
{
    var channelOut = {};
    var result;
    
    result = gSystem.playSound(gSound, null, true, channelOut);
    CHECK_RESULT(result);

    gChannel = channelOut.val;
    
    gChannel.setPaused(false);
}

// Called from main, does some application setup.  In our case we will load some sounds.
function initApplication() 
{
    console.log("Loading sounds\n");

    // Create a sound that loops
    var soundOut = {};
    var result;
    
    result = gSystem.createStream("/wave.mp3", FMOD.LOOP_NORMAL, null, soundOut);
    CHECK_RESULT(result);
    gSound = soundOut.val;
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

    var position = {};
    var length = {};
    result = gSound.getLength(length, FMOD.TIMEUNIT_MS);
    CHECK_RESULT(result);

    if (gChannel)
    {
        result = gChannel.getPosition(position, FMOD.TIMEUNIT_MS);
        CHECK_RESULT(result);
    }
    else
    {
        position.val = 0;
    }

    var openstate = {};
    result = gSound.getOpenState(openstate, null, null, null);
    CHECK_RESULT(result);

    var openstate_string = 
    [
        "FMOD_OPENSTATE_READY",           /* Opened and ready to play. */
        "FMOD_OPENSTATE_LOADING",         /* Initial load in progress. */
        "FMOD_OPENSTATE_ERROR",           /* Failed to open - file not found, out of memory etc.  See return value of Sound::getOpenState for what happened. */
        "FMOD_OPENSTATE_CONNECTING",      /* Connecting to remote host (internet sounds only). */
        "FMOD_OPENSTATE_BUFFERING",       /* Buffering data. */
        "FMOD_OPENSTATE_SEEKING",         /* Seeking to subsound and re-flushing stream buffer. */
        "FMOD_OPENSTATE_PLAYING",         /* Ready and playing, but not possible to release at this time without stalling the main thread. */
        "FMOD_OPENSTATE_SETPOSITION"      /* Seeking within a stream to a different position. */
    ];

    
    document.querySelector("#stream_display_out").value  = "Stream information : position " + position.val + "ms / " + length.val + "ms" ;
    document.querySelector("#stream_display_out2").value = "state : " + openstate_string[openstate.val]; 

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
