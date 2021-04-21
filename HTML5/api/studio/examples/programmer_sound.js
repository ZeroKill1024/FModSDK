/*==============================================================================
Programmer Sound Example
Copyright (c), Firelight Technologies Pty, Ltd 2012-2021.

This example demonstrates how to implement the programmer sound callback to
play an event that has a programmer specified sound.

### See Also ###
Studio::EventInstance::setCallback
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

var gSystem;                            // Global 'System' object which has the Studio API functions.
var gSystemCore;                        // Global 'SystemCore' object which has the Core API functions.
var gEventInstance = {};                // Global Event Instance for the cancel event.
var currentLocalizedBank;               // Global localized bank that is currently loaded
var programmerSoundContext = 
{
    studioSystem: gSystem,
    coreSystem:gSystemCore,
    dialogueString:""
};
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
        "Master Bank.bank",
        "Master Bank.strings.bank",
        "SFX.bank",
        "Dialogue_EN.bank",
        "Dialogue_JP.bank",
        "Dialogue_CN.bank"
    ];

    for (var count = 0; count < fileName.length; count++)
    {
        document.querySelector("#display_out2").value = "Loading " + fileName[count] + "...";

        FMOD.FS_createPreloadedFile(folderName, fileName[count], fileUrl + fileName[count], canRead, canWrite);
    }
}

// Called when the Emscripten runtime has initialized
function main()
{
    // A temporary empty object to hold our system
    var outval = {};
    var result;

    console.log("Creating FMOD System object\n");

    // Create the system and check the result
    result = FMOD.Studio_System_Create(outval);
    CHECK_RESULT(result);

    console.log("grabbing system object from temporary and storing it\n");

    // Take out our System object
    gSystem = outval.val;

    result = gSystem.getCoreSystem(outval);
    CHECK_RESULT(result);

    gSystemCore = outval.val;
    
    // Optional.  Setting DSP Buffer size can affect latency and stability.
    // Processing is currently done in the main thread so anything lower than 2048 samples can cause stuttering on some devices.
    console.log("set DSP Buffer size.\n");
    result = gSystemCore.setDSPBufferSize(2048, 2);
    CHECK_RESULT(result);
    
    // Optional.  Set sample rate of mixer to be the same as the OS output rate.
    // This can save CPU time and latency by avoiding the automatic insertion of a resampler at the output stage.
    // console.log("Set mixer sample rate");
    // result = gSystemCore.getDriverInfo(0, null, null, outval, null, null);
    // CHECK_RESULT(result);
    // result = gSystemCore.setSoftwareFormat(outval.val, FMOD.SPEAKERMODE_DEFAULT, 0)
    // CHECK_RESULT(result);

    console.log("initialize FMOD\n");

    // 1024 virtual channels
    result = gSystem.initialize(1024, FMOD.STUDIO_INIT_NORMAL, FMOD.INIT_NORMAL, null);
    CHECK_RESULT(result);

    // Starting up your typical JavaScript application loop
    console.log("initialize Application\n");

    initApplication();

    // Set up iOS/Chrome workaround.  Webaudio is not allowed to start unless screen is touched or button is clicked.
    function resumeAudio() 
    {
        if (!gAudioResumed)
        {
            console.log("Resetting audio driver based on user input.");

            result = gSystemCore.mixerSuspend();
            CHECK_RESULT(result);
            result = gSystemCore.mixerResume();
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

    // Set the framerate to 50 frames per second, or 20ms.
    console.log("Start game loop\n");

    window.setInterval(updateApplication, 20);

    return FMOD.OK;
}

function programmerSoundCallback(type, eventInstance, parameters)
{   
    if (type == FMOD.STUDIO_EVENT_CALLBACK_CREATE_PROGRAMMER_SOUND)
    {
        console.log("STUDIO_EVENT_CALLBACK_CREATE_PROGRAMMER_SOUND");

        // Get our context from the event instance user data
        var outval = {};
        var context;
        var sound;

        CHECK_RESULT( eventInstance.getUserData(outval) );
        context = outval.val;

        var info = FMOD.STUDIO_SOUND_INFO();
        CHECK_RESULT( context.studioSystem.getSoundInfo(context.dialogueString, info) );
        
        // Create the sound.  This sound is an FSB.  FSB's consist of a 'parent sound' and children/sub sounds.
        CHECK_RESULT( context.system.createSound(info.name_or_data, FMOD.CREATECOMPRESSEDSAMPLE | info.mode, info.exinfo, outval) );
        sound = outval.val;
       
        // Pass the sound to FMOD.  Get a 'subsound' to pass back as the programmer sound.
        CHECK_RESULT( sound.getSubSound(info.subsoundindex, outval) );
        parameters.sound = outval.val;
        parameters.subsoundIndex = info.subsoundindex;
    }
    else if (type == FMOD.STUDIO_EVENT_CALLBACK_DESTROY_PROGRAMMER_SOUND)
    {
        console.log("STUDIO_EVENT_CALLBACK_DESTROY_PROGRAMMER_SOUND");

        // Obtain the sound
        var sound = parameters.sound;

        // Release the sound
        CHECK_RESULT( sound.release() );
    }

    return FMOD.OK;
}

// Function called when user presses HTML Play Sound button, with parameter 0, 1 or 2.
function playEvent()
{
    var bankval = {};

    CHECK_RESULT( currentLocalizedBank.unload() );
    var languageToLoad = document.querySelector('input[name="language"]:checked').value;
    CHECK_RESULT( gSystem.loadBankFile("/" + languageToLoad + ".bank", FMOD.STUDIO_LOAD_BANK_NORMAL, bankval) );
    currentLocalizedBank = bankval.val;

    var dialogueString = document.querySelector('input[name="dialogue"]:checked').value;
    programmerSoundContext.dialogueString = dialogueString;
    CHECK_RESULT( gEventInstance.start() );

}

// Called from main, does some application setup.  In our case we will load some sounds.
function initApplication() 
{
    var outval = {};
    var bankval = {};
    console.log("Loading events\n");

    CHECK_RESULT( gSystem.loadBankFile("/Master Bank.bank", FMOD.STUDIO_LOAD_BANK_NORMAL, outval) );
    CHECK_RESULT( gSystem.loadBankFile("/Master Bank.strings.bank", FMOD.STUDIO_LOAD_BANK_NORMAL, outval) );
    CHECK_RESULT( gSystem.loadBankFile("/SFX.bank", FMOD.STUDIO_LOAD_BANK_NORMAL, outval) );
    CHECK_RESULT( gSystem.loadBankFile("/Dialogue_EN.bank", FMOD.STUDIO_LOAD_BANK_NORMAL, outval) );

    //CHECK_RESULT( gSystem.getBank("Dialogue_EN.bank", bankval) );
    currentLocalizedBank = outval.val;

    // Get the dialogue event
    var eventDescription = {};
    CHECK_RESULT( gSystem.getEvent("event:/Character/Dialogue", outval) );
    eventDescription = outval.val;
    
    CHECK_RESULT( eventDescription.createInstance(outval) );
    gEventInstance = outval.val;

    // Fill our context struct with the Core API system handle.
    CHECK_RESULT( gSystem.getCoreSystem(outval) );
    programmerSoundContext.system = outval.val;
    programmerSoundContext.studioSystem = gSystem;

    // set the context as a user property of the event instance, and set up the callback
    CHECK_RESULT( gEventInstance.setUserData(programmerSoundContext) );
    CHECK_RESULT( gEventInstance.setCallback(programmerSoundCallback, FMOD.STUDIO_EVENT_CALLBACK_CREATE_PROGRAMMER_SOUND | FMOD.STUDIO_EVENT_CALLBACK_DESTROY_PROGRAMMER_SOUND) );

    // Once the loading is finished, re-enable the disabled buttons.
    document.getElementById("playEvent").disabled = false; 
}

// Called from main, on an interval that updates at a regular rate (like in a game loop).
// Prints out information, about the system, and importantly called System::update().
function updateApplication() 
{
    var dsp = {};
    var stream = {};
    var update = {};
    var total = {};
    var result;
    
    result = gSystemCore.getCPUUsage(dsp, stream, null, update, total);
    CHECK_RESULT(result);

    var channelsplaying = {};
    result = gSystemCore.getChannelsPlaying(channelsplaying, null);
    CHECK_RESULT(result);

    document.querySelector("#display_out").value = "Channels Playing = " + channelsplaying.val + 
                                                   " : CPU = dsp " + dsp.val.toFixed(2) + 
                                                   "% stream " + stream.val.toFixed(2) + 
                                                   "% update " + update.val.toFixed(2) + 
                                                   "% total " + total.val.toFixed(2) + 
                                                   "%";
    var numbuffers = {};
    var buffersize = {};
    result = gSystemCore.getDSPBufferSize(buffersize, numbuffers);
    CHECK_RESULT(result) 

    var rate = {};
    result = gSystemCore.getSoftwareFormat(rate, null, null);
    CHECK_RESULT(result);

    var sysrate = {};
    result = gSystemCore.getDriverInfo(0, null, null, sysrate, null, null);
    CHECK_RESULT(result);
    
    var ms = numbuffers.val * buffersize.val * 1000 / rate.val;
    document.querySelector("#display_out2").value = "Mixer rate = " + rate.val + "hz : System rate = " + sysrate.val + "hz : DSP buffer size = " + numbuffers.val + " buffers of " + buffersize.val + " samples (" + ms.toFixed(2) + " ms)";

    // Update FMOD
    result = gSystem.update();
    CHECK_RESULT(result);
}
