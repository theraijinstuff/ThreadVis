/* *******************************************************
 * ThreadArcs.js
 *
 * (c) 2005 Alexander C. Hubmann
 *
 * JavaScript file for Mozilla part of ThreadArcs Extension
 *
 * Version: $Id$
 ********************************************************/


var HTML_NAMESPACE_ =
    "http://www.w3.org/1999/xhtml";
var XUL_NAMESPACE_ =
    "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

var THREADARCS_ = null;

var LOGGER_ = null;

// add visualisation at startup
setTimeout(createThreadArcs, 1000);


/**
 * create one and only one thread arcs object
 */
function createThreadArcs()
{
    if (LOGGER_ == null)
        LOGGER_ = new Logger();

    if (THREADARCS_ == null)
        THREADARCS_ = new ThreadArcs();
}



/**
 * constructor
 */
function ThreadArcs()
{
    LOGGER_.log("ThreadArcs.js: Creating ThreadArcs object");
    // visualisation object
    this.visualisation_ = new Visualisation();

    // threader object
    this.threader_= new Threader();

    // store server to react to server switch
    this.server_ = null;

    // synchronization variables
    this.loaded_ = false;
    this.loading_ = false;
    this.threaded_ = false;
    this.threading_ = false;
    this.clear_ = false;
    
    // add messages when we display first header
    // register this as event handler later
    this.doLoad = {
        onStartHeaders: function()
        {
            THREADARCS_.initMessages();
            THREADARCS_.waitForThreading();
            THREADARCS_.setSelectedMessage();
        },
        onEndHeaders: function()
        {
        }
    }
    gMessageListeners.push(this.doLoad);
}


/**
 * Add all messages from current account
 */
ThreadArcs.prototype.addMessages = function()
{
    LOGGER_.log("ThreadArcs.js: Beginning to add messages");
    this.loading_ = true;
    this.loaded_ = false;
    
    // get root folder
    var folder = GetLoadedMsgFolder();
    var root = folder.rootFolder;
    
    this.server_ = folder.server;
    this.addMessagesFromSubFolders(root);
    
    this.loaded_ = true;
    this.loading_ = false;
    LOGGER_.log("ThreadArcs.js: Messages added");
}


/**
 * Add all messages in this folder
 */
ThreadArcs.prototype.addMessagesFromFolder = function(folder)
{
    // get messages from current folder
    var msg_enumerator = folder.getMessages(null);
    var header = null;
    while (msg_enumerator.hasMoreElements())
    {
        header = msg_enumerator.getNext();
        if (header instanceof Components.interfaces.nsIMsgDBHdr)
        {
            // save current account key
            var date = new Date();
            // PRTime is in microseconds, Javascript time is in milliseconds
            // so divide by 1000 when converting
            date.setTime(header.date / 1000);
            
            // see if msg is a sent mail
            var issent = IsSpecialFolder(header.folder, MSG_FOLDER_FLAG_SENTMAIL, true);
            
            this.threader_.addMessageDetail(header.mime2DecodedSubject , header.mime2DecodedAuthor , header.messageId, header.messageKey, date, header.folder.URI , header.getStringProperty("references"), issent);
        }
    }
}


/**
 * Add all messages from subfolders
 */
ThreadArcs.prototype.addMessagesFromSubFolders = function(folder)
{
    var folder_enumerator = folder.GetSubFolders();
    var current_folder = null;
    while (true)
    {
        try
        {
            current_folder = folder_enumerator.currentItem();
        }
        catch (Exception)
        {
            break;
        }
        
        if (current_folder instanceof Components.interfaces.nsIMsgFolder)
            this.addMessagesFromFolder(current_folder);
        
        if (current_folder.hasSubFolders)
            this.addMessagesFromSubFolders(current_folder);    
        
        try
        {
            folder_enumerator.next();
        }
        catch (Exception)
        {
            break;
        }
    }
}


/**
 * Callback function from extension
 * called after mouse click in extension
 * select message in mail view
 */
ThreadArcs.prototype.callback = function(msgKey, folder)
{
    LOGGER_.log("ThreadArcs.js: User selected message in extension. Display this message.");
    // get folder for message
    SelectFolder(folder);
    
    // clear current selection
    var treeBoxObj = GetThreadTree().treeBoxObject;
    var treeSelection = treeBoxObj.selection;
    treeSelection.clearSelection();
    
    // select message
    gDBView.selectMsgByKey(msgKey);
    
    treeBoxObj.ensureRowIsVisible(treeSelection.currentIndex);
}


/**
 * clear visualisation
 */
ThreadArcs.prototype.clearVisualisation = function()
{
    if (this.clear_)
        return;
    
    this.visualisation_.createStack();
    this.clear_ = true;
}


/**
 * thread all messages
 */
ThreadArcs.prototype.doThreading = function()
{
    if (! this.threading_ && ! this.threaded_)
    {
        this.threading_ = true;
        this.threaded_ = false;
        this.threader_.thread();
    }
    if (this.threading_)
    {
        var done = this.threader_.getDone();
        if (done)
        {
            this.threaded_ = true;
            this.threading_ = false;
            return;
        }
    var ref = this;
    setTimeout(function(){ref.doThreading();}, 100);
    }
}


/**
 * add all messages
 * if not already done
 */
ThreadArcs.prototype.initMessages = function()
{
    if (! this.loaded_ && ! this.loading_)
    {
        this.loading_ = true;
        var ref = this;
        setTimeout(function(){ref.addMessages();}, 100);
    }
}


/**
 * Called when a message is selected
 * Call applet with messageid to visualsíse
 */
ThreadArcs.prototype.setSelectedMessage = function()
{
    if (! this.loaded_ || ! this.threaded_)
    {
        var ref = this;
        setTimeout(function(){ref.setSelectedMessage();}, 100);
        this.clearVisualisation();
        return;
    }
    this.clear_ = false;
    
    // get currently loaded message
    var msg_uri = GetLoadedMessage();
    var msg = messenger.messageServiceFromURI(msg_uri).messageURIToMsgHdr(msg_uri);
    
    LOGGER_.log("ThreadArcs.js: User selected a new message: " + msg.messageId);
    
    if (this.server_ != msg.folder.server)
    {
        LOGGER_.log("ThreadArcs.js: This message belongs to another account. Restart extension.");
        // user just switched account
        this.loaded_ = false;
        this.threaded_ = false;
        this.threader_ = new Threader();
        this.doLoad.onStartHeaders();
    }
    
    // call threader
    // fixxme delay display
    // to give UI time to layout
    var ref = this;
    setTimeout(function(){ref.threader_.visualise(msg.messageId);}, 100);
}


/**
 * clear visualisation
 */
ThreadArcs.prototype.visualise = function(container)
{
    var msgid = "";
    if (container.isDummy())
        msgid = "<DUMMY>";
    else
        msgid = container.getMessage().getId();
    var topcontainer_msgid = container.getTopContainer().isDummy() ? "<DUMMY>" : container.getTopContainer().getMessage().getId();
    LOGGER_.log("ThreadArcs.js: Visualising message: " + msgid + ". Thread Information: Top Container: " + topcontainer_msgid + ". " + container.getTopContainer().getCountRecursive() + " messages");
    this.visualisation_.visualise(container)
}


/**
 * wait for all messages to be added
 * then start threading
 */
ThreadArcs.prototype.waitForThreading = function()
{
    if (this.loaded_ && ! this.threaded_ && ! this.threading_)
    {
        var ref = this;
        setTimeout(function(){ref.doThreading();}, 100);
    }
    else if (! this.threaded_ && ! this.threading_)
    {
        var ref = this;
        setTimeout(function(){ref.waitForThreading();}, 100);
    }
}
