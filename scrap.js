//Processing RSS Feeds
var rss = require('feedparser');
//Processing and Formatting CSVs
var csv = require('fast-csv')
var fs = require('fs')
var cheerio = require('cheerio')
var request = require('request')
//natural language processing to detect entities
var nlp = require('nlp_compromise')
//RSS FEED
var url = "http://allafrica.com/tools/headlines/rdf/latest/headlines.rdf"

var companies = []; //this will store company names from the SAMPLE CSV
var csvArray = []; //this will maintain fields in the SAMPLE CSV
var matches = {}; 
/* Matches will store urls that pertain to certain companies through a dictionary system
    e.g. {Google : "google.com"}
  This will be used after parsing to fill in the corresponding rows of the newly written CSV. 
*/

//Read the sample CSV, make a 'copy' through CSV array, get a list of companies.
fs.createReadStream("data.csv")
  .pipe(csv())
  .on("data", function(data){
    if(data[0] == "Name"){
      data.push("URLs");
      csvArray.push(data);
    }else{
      csvArray.push(data)
      companies.push(data[0].toLowerCase());
    }
  })
  .on("end", function(){
    console.log("done");
    //console.log(csvArray)
    readRSSStream();
  });

//An array of articles that need deeper searching (don't find matches in title or description of RSS Feed)
var links = [];
//Words that are too broad and common to match with companies (filter)
var ignoreWords = ["group","corp","africa", "african"]

/*
Read the rss stream from Africa.com using feedparser.
*/
function readRSSStream(){
  console.log("hello")
  var req = request(url)
  var feedparser = new rss();

  req.on('error', function (error) {
    // handle any request errors
    console.log(error);
  });

  req.on('response', function (res) {
    console.log("received RSS response")
    var stream = this; 

    if (res.statusCode !== 200) {
      this.emit('error', new Error('Bad status code'));
    }else {
      stream.pipe(feedparser);
    }

  });

  feedparser.on('error', function (error) {
    // always handle errors
    console.log(error);
  });

  feedparser.on('readable', function () {
    var stream = this; 
    var meta = this.meta; 
    var item;

    /* The following does a quick search over the RSS Feed title and descriptions
    of the article. If there are no matches found, we send the article over to be
    'deep searched' later. */
    while (item = stream.read()) {
      var found = false;
      for(number in companies){
        var company = companies[number];
        if(nlp.text(item["title"]).match(company)[0] != null){
          appendtoKey(company,item["link"]);
          found = true;
        }else if(nlp.text(item["description"]).match(company)[0] != null){
          appendtoKey(company,item["link"]);
          found = true;
        }
      }
      if(!found){
        links.push(item["link"])
      }
    }
  });
  feedparser.on('end', function(){
    /* Now that parsing is over, we can begin deep searching.
    The following method uses recursion and callbacking to regulate 
    how often we ping allafrica.com */
    checkDeeper(links, 0);

  })
}
/* CheckDeeper calls to checkArticle to search into each article in links[].
SetTimeout is used to regulate the speed of the algorithm :
  AllAfrica.com bans IPs if they detect botting (extremely fast and frequent requesting)
To combat this, I set the time between requests to 5 seconds. Users can change this to their own discretion and at their own risk.
*/
function checkDeeper(links, position){
  if(position < links.length){
    checkArticle(links[position], function(){
      position ++;
      setTimeout(function(){checkDeeper(links,position)}, 5000);
    });
  }else{
    console.log(matches)
    //When the last article is checked, let's write a new CSV with the information we've obtained.
    writeToNewCSVWithArray(csvArray);
  }
}

/*This is a general method for matches. 
If this is the first link related to a company, create a new field.
If not, append the link to an existing array inside the field.
*/
function appendtoKey(key, link){
  if(matches[key] != null){
    var arr = matches[key]
    if(arr.indexOf(link) == -1){
      arr.push(link);
    }
    matches[key] = arr;
  }else{
    matches[key] = [link]
  }
}

/*
Want to do some unit testing? You can test the algorithm with this article : (or just substitute a link)
Just make sure the company you want to detect is inside data.csv.
checkArticle("http://allafrica.com/stories/201706270498.html", function(){
  writeToNewCSVWithArray(csvArray)
});
*/

/* This method performs a deep search on a given article.
  1. HTML Scrap
    Request to the link and return the HTML
    Obtain the text using class tags (.story-body-text), concatenate into a general article
  2. NLP
    Execute natural language processing and filtering to obtain entities mentioned.
    These will be lists of people, organizations, and places.
  3. Filter
    Ignore words that are too broad, too short, or are unrelated.
  4. Match
    Iterate through words and test with the company list.
    If there happens to be a match, use appendToKey() to add to the "matches" object.
*/

function checkArticle(link, callback){
  console.log(link)
  request(link, function (error,response,body){
    console.log('error:', error); // Print the error if one occurred 
    console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received 
    var $ = cheerio.load(body);
    var article = "";
    $('.story-body-text').each(function (i,element){
      //contains text of article in paragraph chunks
      var content = $(this);
      article += content.text() + " ";
    });
    //use nlp to get a list of topics (people, organizations, etc.)
    var org = nlp.text(article).topics()
    console.log(org)
    for(item in org){
      var word = org[item]["text"];
      var place = nlp.text(word).places();
      if(place.length > 0 && nlp.text(word).terms().length == 1){
        //ignore if the word in question is a place and is a single word
      }else if(ignoreWords.indexOf(word) > -1 || word.length < 3){
        //ignore if the word is in ignoreWords, or if it is very short (two chars, like US, UN, etc.)
      }else{
        //Otherwise, search for matches.
        for(number in companies){
          var company = companies[number]
          if(nlp.text(word).terms().length == 1 && nlp.text(company).terms().length > 2){
            //If the word is only one term, and the company name is 3 or more, ignore.
            //E.g Bank v. African Development Bank
          }else{
           if(nlp.text(company).match(word)[0] != null || nlp.text(word).match(company)[0] != null){
              //if there is a match in term, let's print it out and add it to matches.
              console.log(word + " associated with " + company);
              appendtoKey(company, link);
            }
          }
        }
      }
    }
    //When done iterating through everything, let's callback and continue.
    callback();
  });
}
/*
Uses fast-csv to format a new csv with the copied information from reading data.csv
Writes to output.csv in the current directory, and adds urls from companies that have fields
in matches.
*/
function writeToNewCSVWithArray(array){
  var csvStream = csv.createWriteStream({headers: true}),
  writableStream = fs.createWriteStream("output.csv");

  writableStream.on("finish", function(){
    console.log("DONE!");
  });

  csvStream.pipe(writableStream);
  //iterate through the rows, if we see that a company has a field, let's push the contents of the URLs.
  for (obj in csvArray){
    var a = csvArray[obj];
    if(matches[a[0].toLowerCase()] != null){
      //matches[a[0].toLowerCase()] returns an array of links.
      console.log(matches[a[0].toLowerCase()]);
      a = a.concat(matches[a[0].toLowerCase()]);
    }
    csvStream.write(a);
  }
  csvStream.end();
}
