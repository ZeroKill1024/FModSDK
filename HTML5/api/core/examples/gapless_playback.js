/*==============================================================================
Gapless Playback Example
Copyright (c), Firelight Technologies Pty, Ltd 2004-2016.

This example shows how to schedule channel playback into the future with sample
accuracy.  Use several scheduled channels to synchronize 2 or more sounds.
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
var gSound = {};                        // Array of 3 sounds.
var gChannel;                           // Channel that is playing a sound.
var gChannelGroup;                      // ChannelGroup that holds the playing sound.
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

var song = 
[
    "E",   /* Ma-    */
    "D",   /* ry     */
    "C",   /* had    */
    "D",   /* a      */
    "E",   /* lit-   */
    "E",   /* tle    */
    "E",   /* lamb,  */
    "E",   /* .....  */
    "D",   /* lit-   */
    "D",   /* tle    */
    "D",   /* lamb,  */
    "D",   /* .....  */
    "E",   /* lit-   */
    "E",   /* tle    */
    "E",   /* lamb,  */
    "E",   /* .....  */

    "E",   /* Ma-    */
    "D",   /* ry     */
    "C",   /* had    */
    "D",   /* a      */
    "E",   /* lit-   */
    "E",   /* tle    */
    "E",   /* lamb,  */
    "E",   /* its    */
    "D",   /* fleece */
    "D",   /* was    */
    "E",   /* white  */
    "D",   /* as     */
    "C",   /* snow.  */
    "C",   /* .....  */
    "C",   /* .....  */
    "C"    /* .....  */
];

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
        "c.ogg",
        "d.ogg",
        "e.ogg",
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

// Function called when user drags HTML range slider.
function pitchChanged(val)
{
    document.querySelector("#pitch_out").value = val;

    if (gChannelGroup)
    {
        var result = gChannelGroup.setPitch(parseFloat(val));
        CHECK_RESULT(result);
    }
}

function togglePause()
{
    if (gChannelGroup)
    {
        var outval = {};
        var result;
        
        result = gChannelGroup.getPaused(outval)
        CHECK_RESULT(result);
        result = gChannelGroup.setPaused(!outval.val)
        CHECK_RESULT(result);
        document.querySelector("#pause_out").value = outval.val ? "Playing" : "Paused";
    }
}
// Called from main, does some application setup.  In our case we will load some sounds.
function initApplication() 
{
    console.log("Loading sounds\n");

    // Create a sound that loops
    var outval = {};
    var result;
    var dsp_block_len;
    var outputrate;

    result = gSystem.getDSPBufferSize(outval, null);
    CHECK_RESULT(result);
    dsp_block_len = outval.val;

    result = gSystem.getSoftwareFormat(outval, null, null);
    CHECK_RESULT(result);
    outputrate = outval.val;

    /*
        Load 3 sounds - these are just sine wave tones at different frequencies.  C, D and E on the musical scale.
    */
    result = gSystem.createSound("/c.ogg", FMOD.DEFAULT, null, outval);
    CHECK_RESULT(result);
    gSound["C"] = outval.val;

    result = gSystem.createSound("/d.ogg", FMOD.DEFAULT, null, outval);
    CHECK_RESULT(result);
    gSound["D"] = outval.val;

    result = gSystem.createSound("/e.ogg", FMOD.DEFAULT, null, outval);
    CHECK_RESULT(result);
    gSound["E"] = outval.val;

    /* 
        Create a channelgroup that the channels will play on.  We can use this channelgroup as our clock reference. 
        It also means we can pause and pitch bend the channelgroup, without affecting the offsets of the delays, because the channelgroup clock
        which the channels feed off, will be pausing and speeding up/slowing down and still keeping the children in sync.
    */
    result = gSystem.createChannelGroup("Parent", outval);
    CHECK_RESULT(result);
    gChannelGroup = outval.val;

    var numsounds = song.length;

    /*
        Play all the sounds at once! Space them apart with set delay though so that they sound like they play in order.
    */
    var clock_start = 0;
    var count;
    for (count = 0; count < numsounds; count++)
    {
        var slen;
        var s = gSound[song[count]];                                // Pick a note from our tune.

        result = gSystem.playSound(s, gChannelGroup, true, outval); // Play the sound on the channelgroup we want to use as the 
        CHECK_RESULT(result);                                       // parent clock reference (for setDelay further down)
        gChannel = outval.val;

        if (!clock_start)
        {
            result = gChannel.getDSPClock(null, outval);
            CHECK_RESULT(result);
            clock_start = outval.val;

            // Start the sound into the future, by 2 mixer blocks worth.
            // Should be enough to avoid the mixer catching up and hitting the clock value before we've finished setting up everything.
            // Alternatively the channelgroup we're basing the clock on could be paused to stop it ticking.
            clock_start += (dsp_block_len * 2);                     
        }
        else
        {
            var freq;

            result = s.getLength(outval, FMOD.TIMEUNIT_PCM);            // Get the length of the sound in samples. 
            CHECK_RESULT(result);
            slen = outval.val;

            result = s.getDefaults(outval, null);                       // Get the default frequency that the sound was recorded at. 
            CHECK_RESULT(result);

            freq = outval.val;
            slen = slen / freq * outputrate;                            // Convert the length of the sound to 'output samples' for the output timeline. 
            clock_start += slen;                                        // Place the sound clock start time to this value after the last one. 
        }

        result = gChannel.setDelay(clock_start, 0, false);              // Schedule the channel to start in the future at the newly calculated channelgroup clock value.
        CHECK_RESULT(result);

        result = gChannel.setPaused(false);                             // Unpause the sound.  Note that you won't hear the sounds, they are scheduled into the future.
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
