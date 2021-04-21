/*==============================================================================
Event 3D Multi-Listener Example
Copyright (c), Firelight Technologies Pty, Ltd 2012-2021.

This example demonstrates how use listener weighting to crossfade listeners
in and out.
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
var gEventInstance = {};                // Global event Instance for the 3d car engine event. 
var gLastListenerPos = {};              // Vector holding previous frame's listener positions, to calculate velocity for doppler.
var gLastEventPos;                      // Vector holding previous frame's event position, to calculate velocity for doppler.
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
        "Vehicles.bank"
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

    // This is only relevant to this example that uses 'pixels'' to position the event and listener.  Otherwise we would leave it out if the game uses meters as well. (or a predefined unit agreed to with the sound designer)        
    gSystemCore.set3DSettings(1.0, .02, .02); // Distancefactor.  How many pixels in a meter?  We can make something up, lets say 50.  Only affects doppler.  Doppler uses meters per second, so we need to define a meter.
                                                  // Rolloffscale.  Unlike the Core API we cant set min/max distance.  The sound designer set it in 'meters'.  We need to scale it to match pixels per meter as well.
    
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

// Helper function to set a vector
function setVector(vector, x, y, z)
{
    vector.x = x;
    vector.y = y;
    vector.z = z;
}
function copyVector(vector_dest, vector_src)
{
    vector_dest.x = vector_src.x;
    vector_dest.y = vector_src.y;
    vector_dest.z = vector_src.z;
}

// Helper function to load a bank by name.
function loadBank(name)
{
    var bankhandle = {};
    CHECK_RESULT( gSystem.loadBankFile("/" + name, FMOD.STUDIO_LOAD_BANK_NORMAL, bankhandle) );
}

// Function to set the 3d position of the listener or an event (by name)
function update3DPosition( objectname, pos, vel)
{
    var attributes = FMOD._3D_ATTRIBUTES();

    setVector(attributes.forward, 0.0, 0.0, 1.0);
    setVector(attributes.up,      0.0, 1.0, 0.0);
    copyVector(attributes.position, pos)
    copyVector(attributes.velocity, vel)

    if (objectname == "listener1")
    {
        result = gSystem.setListenerAttributes(0, attributes, null);
        CHECK_RESULT(result);
    }
    else if (objectname == "listener2")
    {
        result = gSystem.setListenerAttributes(1, attributes, null);
        CHECK_RESULT(result);
    }
    else if (objectname == "event1")
    {
        result = gEventInstance.set3DAttributes(attributes);
        CHECK_RESULT(result);
    }
}

// Called from main, does some application setup.  In our case we will load some sounds.
function initApplication() 
{
    var eventInstanceOut = {};

    console.log("Loading events\n");

    loadBank("Master Bank.bank");
    loadBank("Master Bank.strings.bank");
    loadBank("Vehicles.bank");
    
    // Get the Car Engine event
    var eventDescription = {};
    CHECK_RESULT( gSystem.getEvent("event:/Vehicles/Ride-on Mower", eventDescription) );
    CHECK_RESULT( eventDescription.val.createInstance(eventInstanceOut) );
    gEventInstance = eventInstanceOut.val;

    CHECK_RESULT( gEventInstance.setParameterByName("RPM", 1000.0, false) );
    CHECK_RESULT( gEventInstance.start() );

     // Position the listener at the origin
    var attributes = FMOD._3D_ATTRIBUTES();

    // Position two listeners
    CHECK_RESULT( gSystem.setNumListeners(2) );

    setVector(attributes.position, 0.0, 0.0, 0.0);
    setVector(attributes.velocity, 0.0, 0.0, 0.0);
    setVector(attributes.forward, 0.0, 0.0, 1.0);
    setVector(attributes.up, 0.0, 1.0, 0.0);
    CHECK_RESULT( gSystem.setListenerAttributes(0, attributes, null ) );
    CHECK_RESULT( gSystem.setListenerAttributes(1, attributes, null ) );
    
    setVector(attributes.position, 0.0, 0.0, 2.0);
    CHECK_RESULT( gEventInstance.set3DAttributes(attributes) );

    gLastListenerPos[0] = FMOD.VECTOR();
    gLastListenerPos[1] = FMOD.VECTOR();
    gLastEventPos = FMOD.VECTOR();

    setVector(gLastListenerPos[0], 0.0, 0.0, 0.0);
    setVector(gLastListenerPos[1], 0.0, 0.0, 0.0);
    setVector(gLastEventPos, 0.0, 0.0, 0.0);   
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

    var rect;
    var pos  = FMOD.VECTOR();
    var vel  = FMOD.VECTOR();

    rect = document.getElementById("listener1").getBoundingClientRect();
    pos.x = rect.left + (rect.width / 2);
    pos.y = 0;
    pos.z = rect.top + (rect.height / 2);
    vel.x = (pos.x - gLastListenerPos[0].x) / 50;     // setinterval is set to 20ms, so 50 times a second.   We need units moved per second, not per update.
    vel.z = (pos.z - gLastListenerPos[0].z) / 50;     // setinterval is set to 20ms, so 50 times a second.   We need units moved per second, not per update.
    update3DPosition("listener1", pos, vel)
    gLastListenerPos[0].x = pos.x;
    gLastListenerPos[0].z = pos.z;

    rect = document.getElementById("listener2").getBoundingClientRect();
    pos.x = rect.left + (rect.width / 2);
    pos.y = 0;
    pos.z = rect.top + (rect.height / 2);
    vel.x = (pos.x - gLastListenerPos[1].x) / 50;     // setinterval is set to 20ms, so 50 times a second.   We need units moved per second, not per update.
    vel.z = (pos.z - gLastListenerPos[1].z) / 50;     // setinterval is set to 20ms, so 50 times a second.   We need units moved per second, not per update.
    update3DPosition("listener2", pos, vel)
    gLastListenerPos[1].x = pos.x;
    gLastListenerPos[1].z = pos.z;

    rect = document.getElementById("event1").getBoundingClientRect();
    pos.x = rect.left + (rect.width / 2);
    pos.y = 0;
    pos.z = rect.top + (rect.height / 2);
    vel.x = (pos.x - gLastEventPos.x) / 50;           // setinterval is set to 20ms, so 50 times a second.   We need units moved per second, not per update.
    vel.z = (pos.z - gLastEventPos.z) / 50;           // setinterval is set to 20ms, so 50 times a second.   We need units moved per second, not per update.
    update3DPosition("event1", pos, vel)
    gLastEventPos.x = pos.x;
    gLastEventPos.z = pos.z;

    // Update FMOD
    result = gSystem.update();
    CHECK_RESULT(result);
}
