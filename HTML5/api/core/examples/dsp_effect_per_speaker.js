/*==============================================================================
DSP Effect Per Speaker Example
Copyright (c), Firelight Technologies Pty, Ltd 2004-2016.

This example shows how to manipulate a DSP network and as an example, creates 2
DSP effects, splitting a single sound into 2 audio paths, which it then filters
seperately.

To only have each audio path come out of one speaker each,
DSPConnection::setMixMatrix is used just before the 2 branches merge back together
again.

For more speakers:

 * Use System::setSoftwareFormat
 * Create more effects, currently 2 for stereo (lowpass and highpass), create one
   per speaker.
 * Under the 'Now connect the 2 effects to channeldsp head.' section, connect
   the extra effects by duplicating the code more times.
 * Filter each effect to each speaker by calling DSPConnection::setMixMatrix.  
   Expand the existing code by extending the matrices from 2 in and 2 out, to the 
   number of speakers you require.
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
var gSound;                             // Handle to sound
var gChannel;                           // Handle to playing channel
var gDSP = {};                          // Array of 2 effects
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
        "drumloop.wav"
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
function panChanged(val)
{
    document.querySelector("#pan_out").value = val;

    if (gChannel)
    {
        var result = gChannel.setPan(parseFloat(val));
        CHECK_RESULT(result);
    }
}

// Function called when user presses HTML toggle effects button.
function toggleEffect(effectnumber)
{
    if (gDSP[parseInt(effectnumber)])
    {
        var bypass = {}

        gDSP[parseInt(effectnumber)].getBypass(bypass);
        gDSP[parseInt(effectnumber)].setBypass(!bypass.val);
        document.querySelector("#effect" + effectnumber + "_out").value = bypass.val ? "On" : "Off";
    }
}

// Called from main, does some application setup.  In our case we will load some sounds.
function initApplication() 
{
    console.log("Loading sounds\n");

    var outval = {};
    var result;

    result = gSystem.createStream("/drumloop.wav", FMOD.LOOP_NORMAL, null, outval);
    CHECK_RESULT(result);
    gSound = outval.val;


    result = gSystem.playSound(gSound, null, false, outval);
    CHECK_RESULT(result);
    gChannel = outval.val;
   
    /*
        Create the DSP effects.
    */  
    result = gSystem.createDSPByType(FMOD.DSP_TYPE_LOWPASS, outval);
    CHECK_RESULT(result);
    gDSP[0] = outval.val;

    result = gDSP[0].setParameterFloat(FMOD.DSP_LOWPASS_CUTOFF, 1000.0);
    CHECK_RESULT(result);
    result = gDSP[0].setParameterFloat(FMOD.DSP_LOWPASS_RESONANCE, 4.0);
    CHECK_RESULT(result);

    result = gSystem.createDSPByType(FMOD.DSP_TYPE_HIGHPASS, outval);
    CHECK_RESULT(result);
    gDSP[1] = outval.val;

    result = gDSP[1].setParameterFloat(FMOD.DSP_HIGHPASS_CUTOFF, 4000.0);
    CHECK_RESULT(result);
    result = gDSP[1].setParameterFloat(FMOD.DSP_HIGHPASS_RESONANCE, 4.0);
    CHECK_RESULT(result);

    /*
        Connect up the DSP network
    */

    /*
        When a sound is played, a subnetwork is set up in the DSP network which looks like this.
        Wavetable is the drumloop sound, and it feeds its data from right to left.

        [DSPHEAD]<------------[DSPCHANNELMIXER]<------------[CHANNEL HEAD]<------------[WAVETABLE - DRUMLOOP.WAV]
    */  
    var mastergroup;
    result = gSystem.getMasterChannelGroup(outval);
    CHECK_RESULT(result);
    mastergroup = outval.val;

    var dsphead;
    result = mastergroup.getDSP(FMOD.CHANNELCONTROL_DSP_HEAD, outval);
    CHECK_RESULT(result);
    dsphead = outval.val;

    result = dsphead.getInput(0, outval, 0);
    CHECK_RESULT(result);
    dspchannelmixer = outval.val;

    /*
        Now disconnect channeldsp head from wavetable to look like this.

        [DSPHEAD]             [DSPCHANNELMIXER]<------------[CHANNEL HEAD]<------------[WAVETABLE - DRUMLOOP.WAV]
    */
    result = dsphead.disconnectFrom(dspchannelmixer, null);
    CHECK_RESULT(result);

    /*
        Now connect the 2 effects to channeldsp head.  
        Store the 2 connections this makes so we can set their matrix later.

                  [DSPLOWPASS]
                 /x           
        [DSPHEAD]             [DSPCHANNELMIXER]<------------[CHANNEL HEAD]<------------[WAVETABLE - DRUMLOOP.WAV]
                 \y           
                  [DSPHIGHPASS]
    */
    var dsplowpassconnection;
    result = dsphead.addInput(gDSP[0], outval, 0);      /* x = dsplowpassconnection */
    CHECK_RESULT(result);
    dsplowpassconnection = outval.val;

    var dsphighpassconnection;
    result = dsphead.addInput(gDSP[1], outval, 0);    /* y = dsphighpassconnection */
    CHECK_RESULT(result);
    dsphighpassconnection = outval.val;
    
    /*
        Now connect the channelmixer to the 2 effects

                  [DSPLOWPASS]
                 /x          \
        [DSPHEAD]             [DSPCHANNELMIXER]<------------[CHANNEL HEAD]<------------[WAVETABLE - DRUMLOOP.WAV]
                 \y          /
                  [DSPHIGHPASS]
    */
    result = gDSP[0].addInput(dspchannelmixer, null, 0);     /* Ignore connection - we dont care about it. */
    CHECK_RESULT(result);

    result = gDSP[1].addInput(dspchannelmixer, null, 0);    /* Ignore connection - we dont care about it. */
    CHECK_RESULT(result);

    /*
        Now the drumloop will be twice as loud, because it is being split into 2, then recombined at the end.
        What we really want is to only feed the dsphead<-dsplowpass through the left speaker for that effect, and 
        dsphead<-dsphighpass to the right speaker for that effect.
        We can do that simply by setting the pan, or speaker matrix of the connections.

                  [DSPLOWPASS]
                 /x=1,0      \
        [DSPHEAD]             [DSPCHANNELMIXER]<------------[CHANNEL HEAD]<------------[WAVETABLE - DRUMLOOP.WAV]
                 \y=0,1      /
                  [DSPHIGHPASS]
    */    
    {
        var lowpassmatrix = [ 
                               1.0, 0.0,    // <- output to front left.  Take front left input signal at 1.0.
                               0.0, 0.0     // <- output to front right.  Silence
        ];
        var highpassmatrix = [ 
                                0.0, 0.0,   // <- output to front left.  Silence
                                0.0, 1.0    // <- output to front right.  Take front right input signal at 1.0
        ];

        /* 
            Upgrade the signal coming from the channel mixer from mono to stereo.  Otherwise the lowpass and highpass will get mono signals 
        */
        result = dspchannelmixer.setChannelFormat(0, 0, FMOD.SPEAKERMODE_STEREO);
        CHECK_RESULT(result);

        /*
            Now set the above matrices.
        */
        result = dsplowpassconnection.setMixMatrix(lowpassmatrix, 2, 2, 0);
        CHECK_RESULT(result);
        result = dsphighpassconnection.setMixMatrix(highpassmatrix, 2, 2, 0);
        CHECK_RESULT(result);
    }

    result = gDSP[0].setBypass(true);
    CHECK_RESULT(result);
    result = gDSP[1].setBypass(true);
    CHECK_RESULT(result);

    result = gDSP[0].setActive(true);
    CHECK_RESULT(result);
    result = gDSP[1].setActive(true);
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
