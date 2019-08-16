const { prompt }        = require('enquirer');
const cli               = require("./cli-questions")
const chalk             = require('chalk')
var tconfig           = require ("../../config/config")
var token             = tconfig.token
const axios             = require('axios')
const Bottleneck        = require('bottleneck')
const fs                = require("fs");
const csv               = require('csvtojson');
const { ConcurrencyManager } = require('axios-concurrency')
const parse             = require('parse-link-header')
const log               = console.log
const path              = `./logs/bulkFind/input/courses/courses.csv`
const csvOutput         = `./logs/bulkFind/bulk-output.csv`;
const csvFailed         = `./logs/bulkFind/bulk-failed.csv`;

//THIS SCRIPT WILL OUTPUT TO LOGS/FIND. LOOK FOR YOUR OUTPUT FILE THERE.
//TO DO: ADD PROGRESS BARS FOR CALL EVENTUALLY
//TO DO: Multithreading
const MAX_CONCURRENT_REQUESTS = 5;

const manager = ConcurrencyManager(axios,MAX_CONCURRENT_REQUESTS)

const bulk = (answers) => {
  prompt(cli.bulkQuestions)
  .then(async answers => {
    if(answers.csv_upload_confirm) {
      const courses = await csv().fromFile(path)
      !function (courses) {
        tasks = courses.map(course => {
            return {
              domain: answers.domain,
              searchString: answers.search_string,
              courseNumber: course.canvas_course_id
            }
        })
        Promise.each = async function(arr, fn) { // take an array and a function
          for(const item of arr) await fn(item);
       }
        Promise.each(tasks,fileGet)
      }(courses)
    } else {
      console.log(`\n\nPlease place the input csv in the input folder and run the script again`)
      process.exit
    }
  })
  .catch(error => {log(error)})

  var gconfig = {
    headers: {'Authorization': `Bearer ${token}`},
  }

  const hLP = (link) => {
    p = parse(link)
    return p
  }

  function fileGet(data) {

    return new Promise(async (resolve) => {

      try {
      var domain          = data.domain
      var courseNumber    = data.courseNumber
      var searchString    = data.searchString

      let init = `https://${domain}.instructure.com/api/v1/courses/${courseNumber}/files?search_term=${searchString}&per_page=100&only[]=names`

      function listGet ({url, payload = [], resolver = null}) {
        const config = {
          headers: {'Authorization': `Bearer ${token}`},
        }
        return new Promise((resolve, reject) => {
          axios.get(url, config)
          .then(async res => {
            if (res.data) {
              const data = res.data
              const updatedPayload = [...payload, ...data]
              pl = hLP(res.headers.link)
              if (pl.next) {
                if (pl.next.url) {
                  listGet({
                    url: pl.next.url,
                    payload: updatedPayload,
                    resolver: resolver || resolve
                  })
                }
              } else {
                if (resolver) resolver(updatedPayload)
                resolve(updatedPayload)
              }
            } else {
              console.log("no files")
            }
          })
          .catch(error => {
            log(chalk.hex("#D8000C")('Your files error is: ' + error + " for " + courseNumber ))
            log(init)
          })
        })
      }

      function idMap (data) {
        id_list = data.map(function(item){
          id = item.id
          return id
        })
        return id_list
      }

      function mainSearch (id_list) {

        initPage = `https://${domain}.instructure.com/api/v1/courses/${courseNumber}/pages?per_page=100`
        initDisc = `https://${domain}.instructure.com/api/v1/courses/${courseNumber}/discussion_topics?per_page=100`
        initAssign = `https://${domain}.instructure.com/api/v1/courses/${courseNumber}/assignments?per_page=100`

        function page_lister (initPage) {
          const page_list = listGet({url: initPage})
          return page_list
        }
        function disc_lister (initDisc) {
          const disc_list = listGet({ url: initDisc });
          return disc_list;
        }
        function assign_lister (initAssign) {
          const assign_list = listGet({ url: initAssign });
          return assign_list;
        }
        const courseObj = {
          ids: id_list,
          pages: page_lister(initPage),
          discs: disc_lister(initDisc),
          assign: assign_lister(initAssign)
        }

        let pages = courseObj.pages
        let discs = courseObj.discs
        let assign = courseObj.assign

      //function for calls that don't return body text e.g. pages
      async function pages_searcher (ids, items, domain, courseNumber, gconfig) {
        let files = ids
        let pages = items

        await pages.then(async (result)=> {
          pages = result
          Promise.all(pages.map(page => {
            pageId = page.url
            pid1 = page.page_id
            let pageUrl = `https://${domain}.instructure.com/api/v1/courses/${courseNumber}/pages/${pageId}`
              axios.get(pageUrl, gconfig)
              .then((response) => {
                let pid = response.data.page_id
                log(`checking page: ${pid} in ${courseNumber} `)
                if (response.data.body !== null || undefined) {
                  let body = response.data.body
                  let url = response.data.html_url
                  files.forEach(file => {
                    let searchIndex = body.indexOf(file)
                    if (searchIndex !== -1) {
                      let searchWord = new RegExp('[^\\s"]*' + file + '[^\\s"]*', "g");
                      let matchedWords = body.match(searchWord);
                      log(chalk.hex("#E06666")(`Found "${file}" at ${url}`))
                      for (i = 0; i < matchedWords.length; i++){
                        sd = /download.*[a-zA-Z0-9]/
                        matchedWords[i] = matchedWords[i].replace(sd,"")
                        fs.appendFile(csvOutput, `${file}, ${url}, ${matchedWords[i]}\n`, function(err) {});
                        log(chalk.hex("#E06666")(`${i+1}) ${matchedWords[i]}`))
                      }
                    }
                  })
                }
              })
              .catch(function(error) {
                log("you got this error: " + error + " on " + pageId + "  " + courseNumber)
              })
          }))
        })
      }

      //function for calls that do return body text e.g. discussions, assignments, quizzes
      async function local_searcher (ids, items, courseNumber) {
        let files = ids
        let pages = items
        await pages.then((result)=> {
          pages = result
          for (page of pages) {
            let pageId = page.id
            if (page !== null) {
              let body
              if(page.message) {
                log(`checking discussion: ${pageId} in ${courseNumber} `)
               body = page.message
              } else if (page.description) {
                log(`checking assignment or quiz: ${pageId} in ${courseNumber} `)
                body = page.description
              }
              let url = page.html_url
              files.forEach(file => {
                if (body !== undefined || null) {
                  let searchIndex = body.indexOf(file)
                    if (searchIndex !== -1) {
                      let searchWord = new RegExp('[^\\s"]*' + file + '[^\\s"]*', "g");
                      let matchedWords = body.match(searchWord);
                      log(chalk.hex("#E06666")(`Found "${file}" at ${url}`))
                      for (i = 0; i < matchedWords.length; i++){
                        sd = /\/download.*[a-zA-Z0-9]/
                        matchedWords[i] = matchedWords[i].replace(sd,"")
                        fs.appendFile(csvOutput, `${file}, ${url}, ${matchedWords[i]}\n`, function(err) {});
                        log(chalk.hex("#E06666")(`${i+1}) ${matchedWords[i]}`))
                      }
                    }
                  }
                })
              }
            }
          })
        }

      !async function execute() {
        await local_searcher(id_list, discs, courseNumber) //discussions
        await local_searcher(id_list, assign, courseNumber) //assignments
        await pages_searcher(id_list, pages, domain, courseNumber, gconfig) //pages

        return resolve()
      }()
      }

      try {
        const
          data = await listGet({url: init}),
          id_list = await idMap(data),
          results = await mainSearch(id_list)

      }
      catch { (error => { console.error(error) })
      }
      }
      catch(error) { log(error)
      }
    })
  }
}

module.exports = { bulk }
