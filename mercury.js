
var noop = function(){};
var pick = function(key){ return function(obj){ return obj[key]; }; };
var indexOf = function(match){ return function(obj){ return obj.indexOf(match) }};

var tokenizerStr = '([^a-zA-Z0-9]+)';
var tokenizer = new RegExp(tokenizerStr);

var search = document.getElementById('search');
var container = document.getElementById('tablist');
var deathGround = document.getElementById('tab-death');

var tplcache = {};


var tpl = function(name,values){
  return Object.keys(values||{}).reduce(
    function(context, key){ return context.replace(new RegExp('{{'+key+'}}','g'),values[key]); },
    tplcache[name] || (tplcache[name] = document.getElementById(name).innerHTML)
  );
};

var row = function(tab){
  return tpl('row',{
    favIconUrl:tab.favIconUrl || '',
    title:tab.title,
    url:tab.url
  })
};

var create = function(html){
  var dummy = document.createElement('div');
  dummy.innerHTML = html;
  return dummy.children[0]
}

var getInput = function(){ return search.value.toLowerCase() };

var renderTabs = function(tabs){
    container.innerHTML = tabs.map( row ).join('');
};

var getEl = function(index){
    return container.children[index];
}

var selectResult = function(i){
    index = i;
    [].slice.apply(container.children).forEach(function(child){
        child.className = child.className.replace( /(?:^|\s)active(?!\S)/ , '' )
    });
    container.children[index].className += ' active';
    container.children[index].scrollIntoView(false);
};

var activate = function(tab){
    chrome.tabs.update(tab.id, {active:true}, function(){
        if (tab.windowId !== chrome.windows.WINDOW_ID_CURRENT){
            chrome.windows.update(tab.windowId, {focused:true});
        }
    });
};

var closeTab = function(tab,index,context){
    var el = getEl(index);

    var dummyEl = create(tpl('dummy',{half:(el.offsetHeight/2)}));
    var top = el.offsetTop;

    var dyingTabEl = el.parentElement.replaceChild(dummyEl,el)
    deathGround.appendChild(dyingTabEl);
    dyingTabEl.style.top = top+'px';

    dummyEl.addEventListener('animationend', function(){
      dummyEl.parentElement.removeChild(dummyEl);
      chrome.tabs.remove(tab.id);
      results.splice(index,1);
      selectResult( (index >= results.length) ? results.length-1 : index );
    });

    el.addEventListener('animationend', function(){
      deathGround.removeChild(el);
    });

    dummyEl.className = 'shrink'
    el.className = 'boom';
};

var clickedIndex = function(ev){
  var el = ev.target;
  while (el.tagName.toLowerCase() != "li" && el) el = el.parentElement;
  return Array.prototype.indexOf.call(el.parentNode.children,el);
};



var score = function(terms){ return function(tab){
    var titleTerms = tab.title.toLowerCase().split(tokenizer);
    var urlTerms = tab.url.toLowerCase().split(tokenizer);
    var allTerms = [].concat(titleTerms,urlTerms);

    var matches = terms.map(function(term){
        return allTerms.map( indexOf(term) ).indexOf(0);
    });
    var hasMisMatch = matches.indexOf(-1) >= 0 || !matches.length;
    return {
        score: hasMisMatch ? -1 : matches.reduce(function(a,b){ return a+b },0),
        tab: tab
    }
}};

var getSortedResults = function(tabInfos){
    var inputTokens = getInput().split(tokenizer).filter(function(term){
        return !term.match(tokenizer);
    });

    return getInput() == ""
    ? tabInfos
    : tabInfos
        .map( score(inputTokens) )
        .filter( function(st){ return st.score != -1 } )
        .sort( function(a,b){ return a.score - b.score } )
        .map( pick('tab') );
};

var results = [];
var index = 0;

chrome.tabs.query({}, function(tabInfos){
    var filterAndDraw = function(){
        results = getSortedResults(tabInfos);
        renderTabs(results);
        selectResult(0);
    };

    container.addEventListener('click', function(e){
        index = clickedIndex(e);
        activate(results[index]);
    });
    search.addEventListener('input', filterAndDraw );
    search.addEventListener('keydown', function(ev){
        var forTab = function(fn){ return function(){ fn(results[index], index, results); }; };
        var capture = function(fn){ return function(){ fn(); ev.preventDefault(); return false } };
        var ctrl = function(fn){ return ev.ctrlKey ? fn : noop };
        var meta = function(fn){ return ev.metaKey ? fn : noop };

        var dir = function(x){ return capture(function(){
            index += x + results.length; index %= results.length;
            selectResult(index);
        })};

        var cmds = {
            38: dir(-1),
            40: dir(1),
            78: ctrl(dir(1)),
            80: ctrl(dir(-1)),
            13: forTab(activate),
            8:  meta(capture(forTab(closeTab)))
        };

        return (cmds[ev.keyCode] || noop)();
    });

    filterAndDraw();
    tablist.removeAttribute('class'); // remove heightHack

});

document.addEventListener('keydown', function(){
    search.focus();
});
