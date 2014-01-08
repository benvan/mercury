
var pick = function(key){ return function(obj){ return obj[key]; }; };
var indexOf = function(match){ return function(obj){ return obj.indexOf(match) }};

var tokenizerStr = '([^a-zA-Z0-9]+)';
var tokenizer = new RegExp(tokenizerStr);

var search = document.getElementById('search');
var container = document.getElementById('tablist');

var tpl = document.getElementById('row').innerHTML;



var row = function(tab){
	var replace = function(context, key){ return context.replace('{{'+key+'}}',tab[key]); }
	return ['title','url','favIconUrl'].reduce(replace, tpl);
};

var getInput = function(){ return search.value.toLowerCase() };

var renderTabs = function(tabs){
	container.innerHTML = tabs.map( row ).join('');
};

var selectResult = function(index){
	[].slice.apply(container.children).forEach(function(child){
		child.removeAttribute('class');
	});
	container.children[index].setAttribute('class', 'active');
	container.children[index].scrollIntoView(false);
};

var activate = function(tab){
	chrome.tabs.update(tab.id, {active:true}, function(){
		if (tab.windowId !== chrome.windows.WINDOW_ID_CURRENT){
			chrome.windows.update(tab.windowId, {focused:true});
		}
	});
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
}}

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

chrome.tabs.query({}, function(tabInfos){
	var filterAndDraw = function(){
		results = getSortedResults(tabInfos);
		renderTabs(results);
		selectResult(0);
	};

	var index = 0;
	var results = [];

	search.addEventListener('input', filterAndDraw );
	search.addEventListener('keydown', function(ev){
		if ([38,40].indexOf(ev.keyCode) >= 0 && results.length){
			index += ({ 40: 1, 38: -1 }[ev.keyCode] || 0) + results.length;
			index %= results.length;
			selectResult(index);
			ev.preventDefault();
			return false;
		} else if(ev.keyCode == 13){
			activate(results[index]);
		}
	});

	filterAndDraw();
	tablist.removeAttribute('class'); // remove heightHack


});

document.addEventListener('keydown', function(){
	search.focus();
});


