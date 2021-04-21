/*==============================================================================
Granular Synthesis Example
Copyright (c), Firelight Technologies Pty, Ltd 2004-2016.

This example shows how you can play a string of sounds together without gaps,
using the setDelay command, to produce a granular synthesis style truck engine 
effect.

The basic operation is:

 * Play 2 sounds initially at the same time, the first sound immediately, and
   the 2nd sound with a delay calculated by the length of the first sound.
 * Call setDelay to initiate the delayed playback. setDelay is sample accurate
   and uses -output- samples as the time frame, not source samples. These
   samples are a fixed amount per second regardless of the source sound format,
   for example, 48000 samples per second if FMOD is initialized to 48khz output.
 * Output samples are calculated from source samples with a simple
   source->output sample rate conversion. i.e.
        sound_length *= output_rate
        sound_length /= sound_frequency
 * When the first sound finishes, the second one should have automatically
   started. This is a good oppurtunity to queue up the next sound. Repeat
   step 2.
 * Make sure the framerate is high enough to queue up a new sound before the
   other one finishes otherwise you will get gaps.

These sounds are not limited by format, channel count or bit depth like the 
realtimestitching example is, and can also be modified to allow for overlap,
by reducing the delay from the first sound playing to the second by the overlap
amount.

    #define USE_STREAMS = Use 2 stream instances, created while they play.
    #define USE_STREAMS = Use 6 static wavs, all loaded into memory.

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
var gSound = {};                        // Array of sounds
var gChannel = [ null, null ];          // Last channel that is playing a sound.
var gSlot = 0;
var gStream = 0;
var gAudioResumed  = false;             // Boolean to avoid resetting FMOD on IOS/Chrome every time screen is touched.

var streamname = [ "c.ogg",
                   "d.ogg",
                   "e.ogg"
];

var soundname = [ "truck_idle_off_01.wav",
                  "truck_idle_off_02.wav",
                  "truck_idle_off_03.wav",
                  "truck_idle_off_04.wav",
                  "truck_idle_off_05.wav",
                  "truck_idle_off_06.wav"
];

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

    for (var count = 0; count < streamname.length; count++)
    {
        FMOD.FS_createPreloadedFile(folderName, streamname[count], fileUrl + streamname[count], canRead, canWrite);
    }    
    for (var count = 0; count < soundname.length; count++)
    {
        FMOD.FS_createPreloadedFile(folderName, soundname[count], fileUrl + soundname[count], canRead, canWrite);
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

function togglePause()
{
    var mastergroup;
    var outval = {};

    result = gSystem.getMasterChannelGroup(outval);
    CHECK_RESULT(result);
    mastergroup = outval.val;

    result = mastergroup.getPaused(outval);
    CHECK_RESULT(result);
    paused = outval.val;

    paused = !paused;   // flip the state

    result = mastergroup.setPaused(paused);
    CHECK_RESULT(result);

    document.querySelector("#pause_out").value = paused ? "On" : "Off"; 
}


function queue_next_sound(outputrate, playingchannel, newindex, slot)
{
    var result;
    var newchannel;
    var newsound;
    var outval = {};
    
    if (gStream)
    {
        info = new FMOD.CREATESOUNDEXINFO();
        info.suggestedsoundtype = FMOD.SOUND_TYPE_OGGVORBIS;
        result = gSystem.createStream(streamname[newindex], FMOD.IGNORETAGS | FMOD.LOWMEM, info, outval);
        CHECK_RESULT(result);
        gSound[slot] = outval.val;
        newsound = gSound[slot];
    }
    else
    {
        newsound = gSound[newindex];
    }
    
    result = gSystem.playSound(newsound, null, true, outval);
    CHECK_RESULT(result);
    newchannel = outval.val;
      
    if (playingchannel)
    {    
        var startdelay = 0;
        var soundlength = 0;
        var soundfrequency;
        var playingsound;
        
        /*
            Get the start time of the playing channel.
        */
        result = playingchannel.getDelay(outval, null, null);
        CHECK_RESULT(result);
        startdelay = outval.val;
        
        /*
            Grab the length of the playing sound, and its frequency, so we can caluate where to place the new sound on the time line.
        */
        result = playingchannel.getCurrentSound(outval);
        CHECK_RESULT(result);
        playingsound = outval.val;

        result = playingsound.getLength(outval, FMOD.TIMEUNIT_PCM);
        CHECK_RESULT(result);
        soundlength = outval.val;

        result = playingchannel.getFrequency(outval);
        CHECK_RESULT(result);
        soundfrequency = outval.val;

        
        /* 
            Now calculate the length of the sound in 'output samples'.  
            Ie if a 44khz sound is 22050 samples long, and the output rate is 48khz, then we want to delay by 24000 output samples.
        */
        soundlength *= outputrate;   
        soundlength /= soundfrequency;
        
        startdelay += soundlength; /* Add output rate adjusted sound length, to the clock value of the sound that is currently playing */

        result = newchannel.setDelay(startdelay, 0, false); /* Set the delay of the new sound to the end of the old sound */
        CHECK_RESULT(result);
    }
    else
    {
        var bufferlength;
        var startdelay;

        result = gSystem.getDSPBufferSize(outval, null);
        CHECK_RESULT(result);
        bufferlength = outval.val;

        result = newchannel.getDSPClock(null, outval);
        CHECK_RESULT(result);
        startdelay = outval.val;

        startdelay += (2 * bufferlength);
        result = newchannel.setDelay(startdelay, 0, false);
        CHECK_RESULT(result);
    }
    
    {
        var val, variation;
        
        /*
            Randomize pitch/volume to make it sound more realistic / random.
        */
        result = newchannel.getFrequency(outval);
        CHECK_RESULT(result);
        val = outval.val;

        variation = (Math.random() * 2.0) - 1.0;               /* -1.0 to +1.0 */
        val *= (1.0 + (variation * 0.02));                     /* @22khz, range fluctuates from 21509 to 22491 */
        result = newchannel.setFrequency(val);
        CHECK_RESULT(result);

        result = newchannel.getVolume(outval);
        CHECK_RESULT(result);
        val = outval.val;

        variation = Math.random();                            /*  0.0 to 1.0 */
        val *= (1.0 - (variation * 0.2));                     /*  0.8 to 1.0 */
        result = newchannel.setVolume(val);
        CHECK_RESULT(result);
    }   
        
    result = newchannel.setPaused(false);
    CHECK_RESULT(result);
       
    return newchannel;
}

// Called from main, does some application setup.  In our case we will load some sounds.
function startSounds(stream) 
{
    var outval = {};
    var count, outputrate;

    gStream = parseInt(stream);

    for (count = 0; count < Object.keys(gSound).length; count++)
    {
        if (gSound[count])
        {
            result = gSound[count].release();
            CHECK_RESULT(result);

            gSound[count] = null;
        }
    }
    gChannel[0] = null;
    gChannel[1] = null;

    console.log("Loading sounds\n");

    result = gSystem.getSoftwareFormat(outval, null, null);
    CHECK_RESULT(result);   
    outputrate = outval.val;
   
    if (!gStream)
    {
        for (count = 0; count < streamname.length; count++)
        {
            result = gSystem.createSound(soundname[count], FMOD.IGNORETAGS, 0, outval);
            CHECK_RESULT(result);
            gSound[count] = outval.val;
        }
    }

    /*
        Kick off the first 2 sounds.  First one is immediate, second one will be triggered to start after the first one.
    */
    gChannel[gSlot] = queue_next_sound(outputrate, gChannel[1-gSlot], Math.floor(Math.random() * streamname.length), gSlot);
    gSlot = 1-gSlot;  /* flip */
    gChannel[gSlot] = queue_next_sound(outputrate, gChannel[1-gSlot], Math.floor(Math.random() * streamname.length), gSlot);
    gSlot = 1-gSlot;  /* flip */    
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
    var outval = {};
    var paused;
    var mastergroup;
    var outputrate;

    result = gSystem.getSoftwareFormat(outval, null, null);
    CHECK_RESULT(result);   
    outputrate = outval.val;

    result = gSystem.getMasterChannelGroup(outval);
    CHECK_RESULT(result);
    mastergroup = outval.val;

    /*
        Replace the sound that just finished with a new sound, to create endless seamless stitching!
    */
    
    result = mastergroup.getPaused(outval);
    CHECK_RESULT(result);
    paused = outval.val;

    if (gChannel[gSlot])
    {
        result = gChannel[gSlot].isPlaying(outval);
        if (result != FMOD.ERR_INVALID_HANDLE)
        {
            CHECK_RESULT(result);
        }
        isplaying = outval.val;

        if (!isplaying && !paused)
        {
            if (gStream)
            {
                /* 
                    Release the sound that isn't playing any more. 
                */
                result = gSound[gSlot].release();       
                CHECK_RESULT(result);
                gSound[gSlot] = null;
            }
            
            /*
                Replace sound that just ended with a new sound, queued up to trigger exactly after the other sound ends.
            */
            gChannel[gSlot] = queue_next_sound(outputrate, gChannel[1-gSlot], Math.floor(Math.random() * streamname.length), gSlot);
            gSlot = 1-gSlot;  /* flip */
        }
    }

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
