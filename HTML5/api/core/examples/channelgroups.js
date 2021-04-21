/*==============================================================================
Channel Groups Example
Copyright (c), Firelight Technologies Pty, Ltd 2004-2016.

This example shows how to put channels into channel groups, so that you can
affect a group of channels at a time instead of just one.
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
var gSound = {};                        // Array of 5 sounds.
var gChannel = {};                      // Array of handles to channels that are playing
var gGroup = {};                        // Array of All channelgroups, 0 and 1 as the channelgroups that live under the master as children, and 2 as the master group.
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
        "lion.wav",
        "drumloop.wav",
        "crowd.wav",
        "vacuum.wav" 
    ];

    for (var count = 0; count < fileName.length; count++)
    {
        FMOD.FS_createPreloadedFile(folderName, fileName[count], fileUrl + fileName[count], canRead, canWrite);
    }    
}

// Called when HTML slider is changed to change volume
function volumeChanged(groupid, val)
{
    document.querySelector("#volume_out" + groupid).value = val;

    if (gGroup[groupid])
    {
        var result = gGroup[groupid].setVolume(parseFloat(val));
        CHECK_RESULT(result);
    }
}

// Called when HTML button is pressed to mute a channelgroup
function muteGroup(groupid)
{
    if (gGroup[groupid])
    {
        var result;
        var mute = {}

        result = gGroup[groupid].getMute(mute);
        CHECK_RESULT(result);
        result = gGroup[groupid].setMute(!mute.val);
        CHECK_RESULT(result);

        document.querySelector("#mute" + groupid).value = !mute.val ? "On" : "Off";
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

// Called from main, does some application setup.  In our case we will load some sounds.
function initApplication() 
{
    // Create a sound that loops
    var outval = {};
    var result;

    console.log("Loading sounds\n");

    result = gSystem.createSound("/drumloop.wav", FMOD.LOOP_NORMAL, null, outval);
    CHECK_RESULT(result);
    gSound[0] = outval.val;

    result = gSystem.createSound("/lion.wav", FMOD.LOOP_NORMAL, null, outval);
    CHECK_RESULT(result);
    gSound[1] = outval.val;

    result = gSystem.createSound("/crowd.wav", FMOD.LOOP_NORMAL, null, outval);
    CHECK_RESULT(result);
    gSound[2] = outval.val;

    result = gSystem.createSound("/vacuum.wav", FMOD.LOOP_NORMAL, null, outval);
    CHECK_RESULT(result);
    gSound[3] = outval.val;

    result = gSystem.createChannelGroup("Group A", outval);
    CHECK_RESULT(result);
    gGroup[0] = outval.val;

    result = gSystem.createChannelGroup("Group B", outval);
    CHECK_RESULT(result);
    gGroup[1] = outval.val;

    result = gSystem.getMasterChannelGroup(outval);
    CHECK_RESULT(result);
    gGroup[2] = outval.val;

    /*
        Instead of being independent, set the group A and B to be children of the master group.
    */
    result = gGroup[2].addGroup(gGroup[0], false, null);
    CHECK_RESULT(result);

    result = gGroup[2].addGroup(gGroup[1], false, null);
    CHECK_RESULT(result);

    /*
        Start all the sounds.
    */
    for (count = 0; count < 4; count++)
    {
        result = gSystem.playSound(gSound[count], null, true, outval);
        CHECK_RESULT(result);
        gChannel[count] = outval.val;
        
        result = gChannel[count].setChannelGroup((count < 2) ? gGroup[0] : gGroup[1]);
        CHECK_RESULT(result);
        
        result = gChannel[count].setPaused(false);
        CHECK_RESULT(result);
    }   

    /*
        Change the volume of each group, just because we can! (reduce overall noise).
    */
    result = gGroup[0].setVolume(0.6);
    CHECK_RESULT(result);
    result = gGroup[0].setPan(-0.9);        // Separate Group A by panning it left
    CHECK_RESULT(result);

    result = gGroup[1].setVolume(0.4);
    CHECK_RESULT(result);
    result = gGroup[1].setPan(0.9);         // Separate Group B by panning it right
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
