/*==============================================================================
User Created Sound Example
Copyright (c), Firelight Technologies Pty, Ltd 2004-2016.

This example shows how create a sound with data filled by the user. It shows a
user created static sample, followed by a user created stream. The former
allocates all memory needed for the sound and is played back as a static sample, 
while the latter streams the data in chunks as it plays, using far less memory
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
    // No sounds to load here!    
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
function volumeChanged(val)
{
    document.querySelector("#volume_out").value = val;

    if (gChannel)
    {
        var result = gChannel.setVolume(parseFloat(val));
        CHECK_RESULT(result);
    }
}

// Function to make a lower resolution floating point number.
function f32(double) {  return Math.round(double * 100000) / 100000; }

//    PCM Read callback.  Generates weird sine wave noise
var t1 = 0, t2 = 0;        // time
var v1 = 0, v2 = 0;        // velocity
function pcmreadcallback(sound, data, datalen)
{
    var userdata = {};
    sound.getUserData(userdata);
    userdata = userdata.val;

    console.log("CALLED PCMREADCALLBACK.  Length = " + (datalen >> 2) + " 16bit stereo samples.  Userdata = " + userdata)
    
    for (var count = 0; count < (datalen >> 2); count++)     // >>2 = 16bit stereo (4 bytes per sample)
    {
        // See https://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html#accessing-memory for docs on setValue.
        FMOD.setValue(data + (count * 4) + 0, Math.sin(t1) * 32767.0, 'i16');    // left channel
        FMOD.setValue(data + (count * 4) + 2, Math.sin(t2) * 32767.0, 'i16');    // right channel

        t1 += (0.01   + v1);
        t2 += (0.0142 + v2);
        v1 += f32(Math.sin(t1) * 0.002);    // f32 rounds the number down to make it more like the C version which uses floats.
        v2 += f32(Math.sin(t2) * 0.002);    // f32 rounds the number down to make it more like the C version which uses floats.
    }

    return FMOD.OK;
}

//    PCM Set Position callback.  This is useful if the user calls Channel::setPosition and you want to seek your data accordingly.
function pcmsetposcallback(sound, subsound, position, postype)
{
    var userdata = {};
    sound.getUserData(userdata);
    userdata = userdata.val;

    console.log("CALLED PCMSETPOSCALLBACK.  Position = " + (position >> 2) + " 16 bit stereo samples.  Userdata = " + userdata)

    return FMOD.OK;
}

function playSound(which)
{
    // Create a sound that loops
    var outval = {};
    var result;
    var exinfo = FMOD.CREATESOUNDEXINFO();
    var mode = FMOD.OPENUSER | FMOD.LOOP_NORMAL;

    if (gChannel)
    {
        gChannel.stop();
        t1 = 0; t2 = 0;
        v1 = 0; v2 = 0;
    }

    if (which == 1)
    {
        mode |= FMOD.CREATESTREAM;
    }

    if (gSound)
    {
        gSound.release();
    }

    // Create and play the sound.
    exinfo.numchannels       = 2;                               // Number of channels in the sound. 
    exinfo.defaultfrequency  = 44100;                           // Default playback rate of sound. 
    exinfo.decodebuffersize  = 44100;                           // Chunk size of stream update in samples. This will be the amount of data passed to the user callback. 
    exinfo.length            = exinfo.defaultfrequency * exinfo.numchannels * 2 * 5; // Length of PCM data in bytes of whole song (for Sound::getLength). 2 = sizeof(short int) and 5 = seconds 
    exinfo.format            = FMOD.SOUND_FORMAT_PCM16;         // Data format of sound. 
    exinfo.pcmreadcallback   = pcmreadcallback;                 // User callback for reading. 
    exinfo.pcmsetposcallback = pcmsetposcallback;               // User callback for seeking.
    exinfo.userdata          = 12345678;

    result = gSystem.createSound("", mode, exinfo, outval);     // do not pass null as the filename here (as you would in C).   Must be a valid object, so use "".
    CHECK_RESULT(result);
    gSound = outval.val;

    result = gSystem.playSound(gSound, null, null, outval);
    CHECK_RESULT(result);
    gChannel = outval.val;
}

// Called from main, does some application setup.
function initApplication() 
{
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
