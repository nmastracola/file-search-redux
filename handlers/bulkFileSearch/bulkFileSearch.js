const { prompt }        = require('enquirer');
const cli               = require("./cli-questions")
const chalk             = require('chalk')
const tconfig           = require ("../../config/config")
const token             = tconfig.token
const axios             = require('axios')
const Bottleneck        = require('bottleneck')
const fs                = require("fs");
const csv               = require('csvtojson');
const parse             = require('parse-link-header')
const log               = console.log
const csvCourses        = `./logs/bulkFind/input/courses`
const csvOutput         = `./logs/bulkFind/bulk-output.csv`;
const csvFailed         = `./logs/bulkFind/bulk-failed.csv`;

//THIS SCRIPT WILL OUTPUT TO LOGS/FIND. LOOK FOR YOUR OUTPUT FILE THERE.
//TO DO: ADD PROGRESS BARS FOR CALL EVENTUALLY
//TO DO: Multithreading

const limiter = new Bottleneck({
  minTime: 222
})


const bulk = (answers) => {
  prompt(cli.bulkQuestions).then(answers => {
    if(answers.csv_upload_confirm) {
      fs.readdir(csvCourses, (err, files) => {
        files.forEach(file => {
          let inputCrsFilePath = `${csvCourses}/${file}`
            csv(answers)
            .fromFile(inputCrsFilePath)
            .then(async (courses) => { //ASYNC THIS FOR ALL THAT IS HOLY
              for await (let course of courses) {
                answers.courseNumber = course.canvas_course_id
                fileGet(answers)
              }
          })
        })
      })
    } else {
      console.log(`\n\nPlease place the input files in ${csvCourses} and run the script again`)
      process.exit
    }
  })
}

var gconfig = {
  headers: {'Authorization': `Bearer ${token}`},
}

const hLP = (link) => {
  p = parse(link)
  return p
}

async function fileGet(answers) { 

  var domain          = answers.domain
  var courseNumber    = answers.courseNumber
  var searchString    = answers.search_string

  let init = `https://${domain}.instructure.com/api/v1/courses/${courseNumber}/files?search_term=${searchString}&per_page=100&only[]=names`
  
  function listGet ({url, payload = [], resolver = null}) {
    const config = {
      headers: {'Authorization': `Bearer ${token}`},
    }
    return new Promise((resolve, reject) => {
      axios.get(url, config)
      .then(res => {
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
          return
        }
      })
      .catch(error => {
        console.error(chalk.hex("#D8000C")('Your error is: ', error.response.data.message))
      })
    })
  }

  listGet({url: init})
  .then(data => {
    id_list = data.map(function(item){
      id = item.id
      return id
    })
    return id_list
  })
  .then(async function(id_list) {
    initPage = `https://${domain}.instructure.com/api/v1/courses/${courseNumber}/pages?per_page=100`
    initDisc = `https://${domain}.instructure.com/api/v1/courses/${courseNumber}/discussion_topics?per_page=100`
    initAssign = `https://${domain}.instructure.com/api/v1/courses/${courseNumber}/assignments?per_page=100`
    async function page_lister (initPage) {
      page_list = await listGet({url: initPage})
      return page_list
    }
    async function disc_lister (initDisc) {
      disc_list = await listGet({url: initDisc})
      return disc_list
    }
    async function assign_lister (initAssign) {
      assign_list = await listGet({url: initAssign})
      return assign_list
    }
    const courseObj = {
      pages: await page_lister(initPage),
      discs: await disc_lister(initDisc),
      assign: await assign_lister(initAssign)
    }
    return courseObj
  })
  .then(async courseObj => {
    let pages = courseObj.pages
    let discs = courseObj.discs
    let assign = courseObj.assign
    await local_searcher(id_list, discs, courseNumber) //discussions
    await local_searcher(id_list, assign, courseNumber) //assignments
    await pages_searcher(id_list, pages, domain, courseNumber, gconfig) //pages
  })
  .catch(error => {
    console.error(error)
  })
}
//function for calls that don't return body text e.g. pages
function pages_searcher (ids, items, domain, courseNumber, gconfig) {
  let files = ids
  let pages = items
  for (let page of pages) {
    pageId = page.url
    let pageUrl = `https://${domain}.instructure.com/api/v1/courses/${courseNumber}/pages/${pageId}`
    limiter.submit(() => {
      axios.get(pageUrl, gconfig)
      .then((response) => {
        let pid = response.data.page_id
        log(`checking page: ${pid} in ${courseNumber} `)
        if (response.data !== null) {
          let body = response.data.body
          let url = response.data.html_url
          for (let file of files) {
            let searchIndex = body.indexOf(file)
            if (searchIndex !== -1) {
              let searchWord = new RegExp('[^\\s"]*' + file + '[^\\s"]*', "g");
              let matchedWords = body.match(searchWord);
              log(chalk.hex("#E06666")(`Found "${file}" at ${url}`))
              for (i = 0; i < matchedWords.length; i++){
                fs.appendFile(csvOutput, `${file}, ${url}, ${matchedWords[i]}\n`, function(err) {});
                log(chalk.hex("#E06666")(`${i+1}) ${matchedWords[i]}`))
              }
            }
          }
        }
      })
      .catch(function(error) {
        console.error("you got this error: " + error)
      })
    })
  }
}
//function for calls that do return body text e.g. discussions, assignments, quizzes
async function local_searcher (ids, items, courseNumber) {
  let files = ids
  let pages = items
  for (page in pages) {
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
      let url = pages.html_url
      for (let file of files) {
        if (body !== undefined || null) {
          let searchIndex = body.indexOf(file)
          if (searchIndex !== -1) {
            let searchWord = new RegExp('[^\\s"]*' + file + '[^\\s"]*', "g");
            let matchedWords = body.match(searchWord);
            log(chalk.hex("#E06666")(`Found "${file}" at ${url}`))
            for (i = 0; i < matchedWords.length; i++){
              fs.appendFile(csvOutput, `${file}, ${url}, ${matchedWords[i]}\n`, function(err) {});
              log(chalk.hex("#E06666")(`${i+1}) ${matchedWords[i]}`, style.color.close))
            }
          }
        }
      }
    }
  }
}



module.exports = { bulk }
