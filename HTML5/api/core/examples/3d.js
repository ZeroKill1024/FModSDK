/*==============================================================================
3D Example
Copyright (c), Firelight Technologies Pty, Ltd 2004-2016.

This example shows how to basic 3D positioning of sounds.
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
var gSound = {};                        // Array of sounds.
var gChannel = {};                      // Array of channels , 1 for each sound.
var gLastListener;                      // Remember the previous listener position to calculate movement delta.
var gLastSoundPos = {};                 // Remember previous sound positions to calculate movement deltas.
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
    var fileUrl = "/public/js/";
    var fileName;
    var folderName = "/";
    var canRead = true;
    var canWrite = false;

    fileName = [
        "vacuum.wav",
        "crowd.wav",
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

    console.log("initialize FMOD\n");

    // 1024 virtual channels
    result = gSystem.init(1024, FMOD.INIT_NORMAL, null);
    CHECK_RESULT(result);

    gSystem.set3DSettings(1.0, .05, 1.0);     // Distancefactor.  How many pixels in a meter?  We can make something up, lets say 20.  Only affects doppler.
                                              // For panning and volume, all units are relative so units dont matter.   Doppler uses meters per second, so we need to define a meter.

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


// Function called when user presses HTML Play Sound button, with parameter 0, 1 or 2.
function playSound(soundid)
{
    var channelOut = {};
    var result;

    result = gSystem.playSound(gSound[parseInt(soundid)], null, false, channelOut);
    CHECK_RESULT(result);

    gChannel[soundid] = channelOut.val;
}

// Function to set the 3d position of the listener or an channel (by name)
function update3DPosition( objectname, pos, vel)
{
    var forward = FMOD.VECTOR();
    var up      = FMOD.VECTOR();

    forward.x = 0.0;
    forward.y = 0.0;
    forward.z = 1.0;

    up.x = 0.0;
    up.y = 1.0;
    up.z = 0.0;

    if (objectname == "listener")
    {
        result = gSystem.set3DListenerAttributes(0, pos, vel, forward, up);
        CHECK_RESULT(result);
    }
    else if (objectname == "sound1")
    {
        result = gChannel[0].set3DAttributes(pos, vel);
        CHECK_RESULT(result);
    }
    else if (objectname == "sound2")
    {
        result = gChannel[1].set3DAttributes(pos, vel);
        CHECK_RESULT(result);
    }
}

// Called from main, does some application setup.  In our case we will load some sounds.
function initApplication() 
{
    console.log("Loading sounds\n");

    // Create a sound that loops
    var soundOut = {};
    var result;
    
    result = gSystem.createSound("/crowd.wav", FMOD.LOOP_NORMAL | FMOD._3D, null, soundOut);
    CHECK_RESULT(result);
    gSound[0] = soundOut.val;

    result = gSystem.createSound("/vacuum.wav", FMOD.LOOP_NORMAL | FMOD._3D, null, soundOut);
    CHECK_RESULT(result);
    gSound[1] = soundOut.val;

    // Our units are pixels, so lets scale the min and max distance to pixels as units.
    result = gSound[0].set3DMinMaxDistance(100.0, 100000.0);
    CHECK_RESULT(result);

    result = gSound[1].set3DMinMaxDistance(100.0, 100000.0);
    CHECK_RESULT(result);

    playSound(0);
    playSound(1);

    gLastListener = FMOD.VECTOR();
    gLastSoundPos[0] = FMOD.VECTOR();
    gLastSoundPos[1] = FMOD.VECTOR();

    gLastListener.x = 0;
    gLastListener.y = 0;
    gLastListener.z = 0;

    gLastSoundPos[0].x = 0;
    gLastSoundPos[0].y = 0;
    gLastSoundPos[0].z = 0;

    gLastSoundPos[1].x = 0;
    gLastSoundPos[1].y = 0;
    gLastSoundPos[1].z = 0;
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

    var rect;
    var pos  = FMOD.VECTOR();
    var vel  = FMOD.VECTOR();

    rect = document.getElementById("listener").getBoundingClientRect();
    pos.x = rect.left + (rect.width / 2);
    pos.y = 0;
    pos.z = rect.top + (rect.height / 2);
    vel.x = (pos.x - gLastListener.x) / 50;              // setinterval is set to 20ms, so 50 times a second.   We need units moved per second, not per update.
    vel.z = (pos.z - gLastListener.z) / 50;              // setinterval is set to 20ms, so 50 times a second.   We need units moved per second, not per update.
    update3DPosition("listener", pos, vel)
    gLastListener.x = pos.x;
    gLastListener.z = pos.z;

    rect = document.getElementById("sound1").getBoundingClientRect();
    pos.x = rect.left + (rect.width / 2);
    pos.y = 0;
    pos.z = rect.top + (rect.height / 2);
    vel.x = (pos.x - gLastSoundPos[0].x) / 50;           // setinterval is set to 20ms, so 50 times a second.   We need units moved per second, not per update.
    vel.z = (pos.z - gLastSoundPos[0].z) / 50;           // setinterval is set to 20ms, so 50 times a second.   We need units moved per second, not per update.
    update3DPosition("sound1", pos, vel)
    gLastSoundPos[0].x = pos.x;
    gLastSoundPos[0].z = pos.z;

    rect = document.getElementById("sound2").getBoundingClientRect();
    pos.x = rect.left + (rect.width / 2);
    pos.y = 0;
    pos.z = rect.top + (rect.height / 2);
    vel.x = (pos.x - gLastSoundPos[1].x) / 50;           // setinterval is set to 20ms, so 50 times a second.   We need units moved per second, not per update.
    vel.z = (pos.z - gLastSoundPos[1].z) / 50;           // setinterval is set to 20ms, so 50 times a second.   We need units moved per second, not per update.
    update3DPosition("sound2", pos, vel)
    gLastSoundPos[1].x = pos.x;
    gLastSoundPos[1].z = pos.z;

    // Update FMOD
    result = gSystem.update();
    CHECK_RESULT(result);
}
