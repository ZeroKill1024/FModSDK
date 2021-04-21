/*==============================================================================
Custom DSP Example
Copyright (c), Firelight Technologies Pty, Ltd 2004-2021.

This example shows how to add a user created DSP callback to process audio 
data. The read callback is executed at runtime, and can be added anywhere in
the DSP network.
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
var gSound;                             // User Sound
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

    fileUrl = "/public/js/stereo.mp3";
    fileName = "/stereo.mp3";
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

var gDSP = null;

function myDSPCallback(dsp_state, inbuffer, outbuffer, length, inchannels, outchannels) 
{    
    /*
        This loop assumes inchannels = outchannels, which it will be if the DSP is created with '0' 
        as the number of channels in FMOD.DSP_DESCRIPTION.  
        Specifying an actual channel count will mean you have to take care of any number of channels coming in,
        but outputting the number of channels specified. Generally it is best to keep the channel 
        count at 0 for maximum compatibility.
    */
    for (var samp = 0; samp < length; samp++) 
    { 
        /*
            Feel free to unroll this.
        */
        for (var chan = 0; chan < outchannels; chan++)
        {
            /* 
                This DSP filter just halves the volume! 
                Input is modified, and sent to output.
            */
            let val = FMOD.getValue(inbuffer + (((samp * inchannels) + chan) * 4), 'float') * dsp_state.plugindata.volume_linear;

            FMOD.setValue(outbuffer + (((samp * outchannels) + chan) * 4), val, 'float');
            dsp_state.plugindata.buffer[(samp * outchannels) + chan] = val;
        }
    }

    dsp_state.plugindata.channels = inchannels;

    return FMOD.OK; 
} 

/*
    Callback called when DSP is created.   This implementation creates a structure which is attached to the dsp state's 'plugindata' member.
*/
function myDSPCreateCallback(dsp_state)
{
    let outval = {};
    let blocksize = 0;
    let result = 0;

    result = dsp_state.functions.getblocksize(dsp_state, outval);
    CHECK_RESULT(result);

    let outval2 = {};
    result = dsp_state.functions.getsamplerate(dsp_state, outval);
    CHECK_RESULT(result);

    result = dsp_state.functions.getspeakermode(dsp_state, outval, outval2);
    CHECK_RESULT(result);

    blocksize = outval.val;

    dsp_state.plugindata =     
    {
        buffer: [],
        volume_linear: 1.0,
        length_samples : blocksize,
        channels: 0
    };

    return FMOD.OK;
}

/*
    Callback called when DSP is destroyed.   
*/
function myDSPReleaseCallback(dsp_state)
{
    return FMOD.OK;
}

/*
    Callback called when DSP::getParameterData is called.   This returns a pointer to the raw floating point PCM data.
    We have set up 'parameter 0' to be the data parameter, so it checks to make sure the passed in index is 0, and nothing else.
*/
function myDSPGetParameterDataCallback(dsp_state, index, data, length, valuestr)
{
    if (index == 0)
    {
        let blocksize = 0;
        let result = 0;
        let mydata = dsp_state.plugindata;
        let outval = {}

        result = dsp_state.functions.getblocksize(dsp_state, outval);
        CHECK_RESULT(result);

        blocksize = outval.val;

        data.val = mydata;
        length.val = blocksize * 2 * 4; /* 4 = sizeof float */

        return FMOD.OK;
    }

    return FMOD.ERR_INVALID_PARAM;
}

/*
    Callback called when DSP::setParameterFloat is called.   This accepts a floating point 0 to 1 volume value, and stores it.
    We have set up 'parameter 1' to be the volume parameter, so it checks to make sure the passed in index is 1, and nothing else.
*/
function myDSPSetParameterFloatCallback(dsp_state, index, value)
{
    if (index == 1)
    {
        dsp_state.plugindata.volume_linear = value;

        return FMOD.OK;
    }

    return FMOD.ERR_INVALID_PARAM;
}

/*
    Callback called when DSP::getParameterFloat is called.   This returns a floating point 0 to 1 volume value.
    We have set up 'parameter 1' to be the volume parameter, so it checks to make sure the passed in index is 1, and nothing else.
    An alternate way of displaying the data is provided, as a string, so the main app can use it.
*/
function myDSPGetParameterFloatCallback(dsp_state, index, value, valuestr)
{
    if (index == 1)
    {
        value.val = dsp_state.plugindata.volume_linear;
        if (valuestr)
        {
            valuestr.val = "" + Math.floor((dsp_state.plugindata.volume_linear * 100.0)+0.5);
        }

        return FMOD.OK;
    }

    return FMOD.ERR_INVALID_PARAM;
}

// Called from main, does some application setup.  In our case we will load some sounds.
function initApplication() 
{
    var outval = {};
    var result;

    console.log("Loading sounds\n");

    // Create a sound that loops    
    result = gSystem.createStream("/stereo.mp3", FMOD.LOOP_NORMAL, null, outval);
    CHECK_RESULT(result);
    gSound = outval.val;

    result = gSystem.playSound(gSound, null, false, outval);
    CHECK_RESULT(result);

    /*
        Create the DSP effect.
    */  
    { 
        var wavedata_desc = FMOD.DSP_PARAMETER_DESC();
        wavedata_desc.type                 = FMOD.DSP_PARAMETER_TYPE_DATA;
        wavedata_desc.name                 = "wave data";
        wavedata_desc.label                = "";
        wavedata_desc.description          = "wave data";
        wavedata_desc.datadesc.datatype    = FMOD.DSP_PARAMETER_DATA_TYPE_USER;

        var volume_desc = FMOD.DSP_PARAMETER_DESC();
        volume_desc.type                   = FMOD.DSP_PARAMETER_TYPE_FLOAT;
        volume_desc.name                   = "volume";
        volume_desc.label                  = "%";
        volume_desc.description            = "linear volume in percent";
        volume_desc.floatdesc.min          = 0; 
        volume_desc.floatdesc.max          = 2; 
        volume_desc.floatdesc.defaultval   = 1;
        volume_desc.floatdesc.mapping      = {};
        volume_desc.floatdesc.mapping.type = FMOD.DSP_PARAMETER_FLOAT_MAPPING_TYPE_LINEAR; 

        var dspdesc = FMOD.DSP_DESCRIPTION();
        dspdesc.name                       = "My first DSP unit";
        dspdesc.version                    = 0x00010000;
        dspdesc.numinputbuffers            = 1;
        dspdesc.numoutputbuffers           = 1;
        dspdesc.read                       = myDSPCallback; 
        dspdesc.create                     = myDSPCreateCallback;
        dspdesc.release                    = myDSPReleaseCallback;
        dspdesc.getparameterdata           = myDSPGetParameterDataCallback;
        dspdesc.setparameterfloat          = myDSPSetParameterFloatCallback;
        dspdesc.getparameterfloat          = myDSPGetParameterFloatCallback;
        dspdesc.numparameters              = 2;
        dspdesc.paramdesc                  = [ wavedata_desc, volume_desc ];

        result = gSystem.createDSP(dspdesc, outval); 
        CHECK_RESULT(result); 

        gDSP = outval.val;
    } 

    result = gSystem.getMasterChannelGroup(outval);
    CHECK_RESULT(result);

    mastergroup = outval.val;

    result = mastergroup.addDSP(0, gDSP);
    CHECK_RESULT(result);

    document.querySelector("#bypass_out").value = "active";
}


// Function called when user drags HTML range slider.
function volumeChanged(val)
{
    document.querySelector("#volume_out").value = val;

    if (gDSP)
    {
        result = gDSP.setParameterFloat(1, parseFloat(val));
        CHECK_RESULT(result);
    }
}

function toggleBypass()
{
    let outval = {};

    result = gDSP.getBypass(outval);
    CHECK_RESULT(result);

    bypass = outval.val;

    bypass = !bypass;

    result = gDSP.setBypass(bypass);
    CHECK_RESULT(result);

    document.querySelector("#bypass_out").value = bypass ? "inactive" : "active";
}

// Called from main, on an interval that updates at a regular rate (like in a game loop).
// Prints out information, about the system, and importantly calles System::udpate().
function updateApplication() 
{
    var bypass;
    let outval = {};

    /*
        Display standard stuff
    */
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
    }

    result = gDSP.getBypass(outval);
    CHECK_RESULT(result);

    result = gSystem.update();
    CHECK_RESULT(result);

    {
        let outval2 = {}, outval3 = {};

        // Not supported yet
        // result = gDSP.getParameterInfo(1, outval);
        // CHECK_RESULT(result);
        // let desc = outval.val;

        result = gDSP.getParameterFloat(1, 0, outval);
        CHECK_RESULT(result);
        let volstr = outval.val;

        result = gDSP.getParameterData(0, outval, outval2, outval3);
        CHECK_RESULT(result);
        let data = outval.val;

        if (data.channels)
        {
            let channel = 0;
            for (channel = 0; channel < data.channels; channel++)
            {
                let count,level;
                let max = 0;
                let display = "================================================================================";

                for (count = 0; count < data.length_samples; count++)
                {
                    if (Math.abs(data.buffer[(count * data.channels) + channel]) > max)
                    {
                        max = Math.abs(data.buffer[(count * data.channels) + channel]);
                    }
                }
                level = max * 40.0;                                

                document.querySelector("#display_out"+channel).value = channel + " " + display.substr(0, level);

            }
        }
    }
}
