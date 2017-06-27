# AfricaParse
Scrape Assignment for Releaf, using NodeJS, RSS Parsing, CSV Parsing, and NLP frameworks.
<br>
Created by <a href = "http://ichauster.github.io">Ivan Chau</a>
<br>
Check out this demo :
<a href = "https://www.dropbox.com/s/007aeetvs1j34bj/IvanChauRELEAF.mp4?dl=0">Video</a>

## wanna try?
Install dependencies
`npm install`

run with `node app.js`

### basics/features
0. Reads CSVs and obtains companies that are being looked for
1. Parses RSS Feed and uses NLP for simple searches through description and title
2. Requests and performs HTML scrapping on AllAfrica.com articles
3. Uses NLP to detect entities like organizations, people, and places inside the article
4. Finds articles that contain the companies and rewrites them into a new CSV in their pertaining rows. (output.csv)


