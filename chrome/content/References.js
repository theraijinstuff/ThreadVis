/** ****************************************************************************
 * References.js
 *
 * (c) 2005-2006 Alexander C. Hubmann
 *
 * Wrapper for references
 * Re-write from Java
 *
 * $Id$
 ******************************************************************************/



/** ****************************************************************************
 * Constructor
 * references == string of references
 ******************************************************************************/
function References(references)
{
    // Store message ids of references
    this.references_ = new Object();

    this.buildReferences(references);
}



/** ****************************************************************************
 * build references array
 ******************************************************************************/
References.prototype.buildReferences = function(references)
{
    if (references != null && references != "")
    {
        var result = references.match(/[^<>\s]+/g);
        
        if (result)
            for (var i = 0; i < result.length; i++)
                this.references_[result[i]] = result[i];
    }
}



/** ****************************************************************************
 * get references array
 ******************************************************************************/
References.prototype.getReferences = function()
{
    return this.references_;
}



/** ****************************************************************************
 * get string representation of object
 ******************************************************************************/
References.prototype.toString = function()
{
    //return this.references_;
    var string = "";
    for (referenceskey in this.references_)
    {
        string += ", " + this.references_[referenceskey];
    }
    return string;
}
