/*==============================================================================
Convolution Reverb Example
Copyright (c), Firelight Technologies Pty, Ltd 2004-2016.

This example shows how to set up a convolution reverb DSP as a global
DSP unit that can be routed into by multiple seperate channels.

Convolution reverb uses data from a real world locations called an 
"Impulse Response" to model the reflection of audio waves back
to a listener.

Impulse Response is based on "St Andrew's Church" by

    www.openairlib.net
    Audiolab, University of York
    Damian T. Murphy
    http://www.openairlib.net/auralizationdb/content/st-andrews-church

licensed under Attribution Share Alike Creative Commons license
http://creativecommons.org/licenses/by-sa/3.0/


Anechoic sample "Operatic Voice" by 

    www.openairlib.net
    http://www.openairlib.net/anechoicdb/content/operatic-voice

licensed under Attribution Share Alike Creative Commons license
http://creativecommons.org/licenses/by-sa/3.0/

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
var gReverb = {};                       // Array of All channelgroups, 0 and 1 as the channelgroups that live under the master as children, and 2 as the master group.
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
        "standrews.wav",
        "singing.wav"
    ];

    for (var count = 0; count < fileName.length; count++)
    {
        FMOD.FS_createPreloadedFile(folderName, fileName[count], fileUrl + fileName[count], canRead, canWrite);
    }    
}

function dryMixChanged(val)
{
    document.querySelector("#drymix_out").value = val;

    if (gReverb)
    {
        var result = gReverb.setParameterFloat(FMOD.DSP_CONVOLUTION_REVERB_PARAM_DRY, parseFloat(val));
        CHECK_RESULT(result);
    }
}

function wetMixChanged(val)
{
    document.querySelector("#wetmix_out").value = val;

    if (gReverb)
    {
        var result = gReverb.setParameterFloat(FMOD.DSP_CONVOLUTION_REVERB_PARAM_WET, parseFloat(val));
        CHECK_RESULT(result);
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

function concatTypedArrays(a, b) { // a, b TypedArray of same type
    var c = new (a.constructor)(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
}

// Called from main, does some application setup.  In our case we will load some sounds.
function initApplication() 
{
    // Create a sound that loops
    var result;

    console.log("Loading sounds\n");

    /*
        Create a new channel group to hold all the channels and process the dry path
    */
    var mainGroup = {};
    result = gSystem.createChannelGroup("main", mainGroup);
    CHECK_RESULT(result);
    mainGroup = mainGroup.val;

    /*
        Create the convultion DSP unit and set it as the tail of the channel group
    */
    result = gSystem.createDSPByType(FMOD.DSP_TYPE_CONVOLUTIONREVERB, gReverb);
    CHECK_RESULT(result);
    gReverb = gReverb.val;

    result = mainGroup.addDSP(FMOD.CHANNELCONTROL_DSP_TAIL, gReverb);
    CHECK_RESULT(result);

    /*
        Open the impulse response wav file, but use FMOD_OPENONLY as we want
        to read the data into a seperate buffer
    */
    var irSound = {};
    result = gSystem.createSound("/standrews.wav", FMOD.DEFAULT | FMOD.OPENONLY, null, irSound);
    CHECK_RESULT(result);
    irSound = irSound.val;

    /*
        Retrieve the sound information for the Impulse Response input file
    */
    var irSoundFormat = {};
    var irSoundType = {};
    var irSoundBits = {};
    var irSoundChannels = {};
    result = irSound.getFormat(irSoundType, irSoundFormat, irSoundChannels, irSoundBits);
    CHECK_RESULT(result);
    irSoundFormat = irSoundFormat.val;
    irSoundType = irSoundType.val;
    irSoundChannels = irSoundChannels.val;
    irSoundBits = irSoundBits.val;

    var irSoundLength = {};
    result = irSound.getLength(irSoundLength, FMOD.TIMEUNIT_PCM);
    CHECK_RESULT(result);
    irSoundLength = irSoundLength.val;

    
    if (irSoundFormat != FMOD.SOUND_FORMAT_PCM16)
    {
        /*
            For simplicity of the example, if the impulse response is the wrong format just display an error
        */        
        CHECK_RESULT(FMOD_ERR_FORMAT);
    }

    /*
        The reverb unit expects a block of data containing a single 16 bit int containing
        the number of channels in the impulse response, followed by PCM 16 data
    */
    var wordSize16 = 2;                                                             // Data is 16bit
    var irDataLength = wordSize16 + (wordSize16 * irSoundLength * irSoundChannels); // Length in bytes.  extra word is the length value;  
    var irData_A = new ArrayBuffer(wordSize16);                                     // 1st 'array'' to store length only for now.
    var irData_B = {};                                                              // 2nd array which will contain sound data after Sound::readData call. 
    var irData;                                                                     // Final concatenated array which is passed to DSP::setParameterData 

    new Uint16Array(irData_A)[0] = irSoundChannels;                                 // Write a 16bit length value to array A.
  
    result = irSound.readData(irData_B, irDataLength - 2, null);                    // Read raw 16bit PCM sound data into array B.
    CHECK_RESULT(result);

    irData_f = concatTypedArrays(new Uint8Array(irData_A), irData_B.val);           // Add the length word, and raw 16bit PCM sound data together.

    result = gReverb.setParameterData(FMOD.DSP_CONVOLUTION_REVERB_PARAM_IR, irData_f, irDataLength);
    CHECK_RESULT(result);

    result = gReverb.setParameterFloat(FMOD.DSP_CONVOLUTION_REVERB_PARAM_WET, -6.0);
    CHECK_RESULT(result);

    /*
        We can now free our copy of the IR data and release the sound object, the reverb unit 
        has created it's internal data
    */
    result = irSound.release();
    CHECK_RESULT(result);
    
    /*
        Load up and play a sample clip recorded in an anechoic chamber
    */
    var outval = {};
    result = gSystem.createSound("/singing.wav", FMOD._3D | FMOD.LOOP_NORMAL, null, outval);
    CHECK_RESULT(result);
    gSound[0] = outval.val;

    result = gSystem.playSound(gSound[0], mainGroup, true, outval);
    CHECK_RESULT(result);
    gChannel[0] = outval.val;
    
    result = gChannel[0].setPaused(false);
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
