// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE
// Modified to adjust to FitNesse.org basic needs
// Extended version to use ?autoComplete responder (com.github.tcnh)

var autoCompleteJson;
var searcher;
var classSearcher;
var classFilter;
var filteredClasses;

function loadAutoCompletesFromResponder() {
    $("#spinner").show();
    $('.toggle-bar').hide();
    if(window.location.pathname.indexOf("ScenarioLibrary") !== -1
        || window.location.pathname.indexOf("SetUp") !== -1
        || window.location.pathname.indexOf("TearDown") !== -1
        || window.location.href.indexOf("?new") !== -1) {
            pageDataUrl = window.location.origin + "/" + getCookie('latestContext') + "?autoComplete";
    	} else {
            pageDataUrl = window.location.pathname.split('?')[0] + "?autoComplete";
    	}
    autocompletes = [];
    return $.ajax({
            dataType: "json",
            url: pageDataUrl,
    		async: true,
            cache: true,
            timeout: 20000,
            success: function(result) {
            autoCompleteJson = result;
            $.each(result.classes, function(cIndex, c) {
                 $.each(c.constructors, function(constrIndex, constructor) {
                    autocompletes.push(constructor.usage.substring(2))
                 });
                 autocompletes.push(c.readableName);
                 $.each(c.methods, function(mIndex, m) {
                    var methodEntry = m.usage.substring(2);
                    autocompletes.push(methodEntry);
                    });
                 });
    		     $.each(result.scenarios, function(sIndex, s) {
    		     var scenarioEntry = s.wikiText;
                    autocompletes.push(scenarioEntry);
    		     });
    		     $.each(result.variables, function(vIndex, v) {
    		      autocompletes.push(v.varName);
             });
             filteredClasses = null;
             result.classes.forEach(c => c.oldReadableName = c.readableName);
             classSearcher = new FuzzySearch({source:autoCompleteJson.classes, score_acronym:true, keys:["constructors.*.usage"] });
             classFilter = new FuzzySearch({source:autoCompleteJson.classes, score_acronym:true, keys:["constructors.*.usage", "methods.*.usage"], thresh_relative_to_best:0.75, thresh_include:5.0, highlight_prefix:true });
             searcher = new FuzzySearch({source:autocompletes, score_acronym:true });
    		     $("#spinner").hide();
    		     $('.toggle-bar').show();
            },
            error: function() {
              console.log("Unable to retrieve page context from autoComplete Responder. Is it installed?");
            }
    });
}

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
  "use strict";
  $("#spinner").show();
  var WORD = /([@>!$\w]\w*)([^|]*\|)?/, RANGE = 500;
  var autonames = [];
  var pageDataUrl = window.location.pathname + "?names";
      $.ajax({
        url: pageDataUrl,
		async: true,
        cache: true,
        timeout: 20000,
        success: function(result) {
		    autonames = result.split(/\r?\n/);
        },
        error: function() {
          console.log("Error Accessing Child Page Names");
        }
      });


    loadAutoCompletesFromResponder();

  CodeMirror.registerHelper("hint", "fitnesse_anyword", function(editor, options) {
    var word = options && options.word || WORD;
    var range = options && options.range || RANGE;
    var cur = editor.getCursor(), curLine = editor.getLine(cur.line);
    var end = cur.ch, start = end;
    while (start && "|:".indexOf(curLine.charAt(start - 1)) <0) --start;
    var curWord = start != end && curLine.slice(start, end).toLocaleLowerCase();

    var result = [];
    
    var previousLineIndex = cur.line > 0 ? cur.line-1 : 0;
    var previousLine = editor.getLine(previousLineIndex).trim();
    var classLine = editor.getLine(previousLineIndex).trim();
    while(previousLineIndex>0 && (classLine.startsWith("|") || classLine.startsWith("!|"))) {
      previousLineIndex--;
      classLine = editor.getLine(previousLineIndex).trim();
    } 
    classLine = editor.getLine(previousLineIndex+1).trim();

    // We're on a query
    var isScript = classLine.toLocaleLowerCase().indexOf("script") > 0;
    var isFirstRow = previousLineIndex == cur.line-1;
    var isSecRow = previousLineIndex == cur.line-2;

    if(isFirstRow) {
        result = classSearcher.search(curWord).map(r=>r.constructors[0].usage);
      }
      else if(isSecRow || isScript){
        var className = classLine.split("|")[1].trim();
        var resultClass = classSearcher.search(className);
        if(resultClass != null){
          if(curWord == false || curWord.trim().length == 0){
            result = resultClass[0].methods.map(m => m.usage);
            // remove already added properties
            var alreadyAdded = curLine.split('|').map(p => p.trim());
            result = result.filter( r=> {
              var rTrim = r.split('|')[1].trim();
              if(rTrim == curWord) return true;
              else return !alreadyAdded.includes(rTrim);
            });
          }
          else {
            var methodSearcher = new FuzzySearch({source:resultClass[0].methods, token_field_min_length:0, keys:["usage"]});
            result = methodSearcher.search(curWord).map(r => r.usage);
          }
        }
        else {
          result = searcher.search(curWord);
        }
      }
    else{
      result = searcher.search(curWord);
    }

    return {list: result, from: CodeMirror.Pos(cur.line, (start >0 ? --start : start)), to: CodeMirror.Pos(cur.line, end)};


  });


});
