const { prompt }        = require('enquirer');
const cli               = require("./cli-questions")
const chalk             = require('chalk')
const config            = require ("../../config/config")
const token             = config.token
const axios             = require('axios')
const Bottleneck             = require('bottleneck')
const fs                = require("fs");
const csv               = require('csvtojson');
const parse             = require('parse-link-header')
const log               = console.log
const _cliProgress      = require('cli-progress')
const csvStrings        = `./logs/bulkFind/input/strings`
const csvCourses        = `./logs/bulkFind/input/courses`
const csvOutput         = `./logs/bulkFind/bulk-output.csv`;
const csvFailed         = `./logs/bulkFind/bulk-failed.csv`;

//THIS SCRIPT WILL OUTPUT TO LOGS/FIND. LOOK FOR YOUR OUTPUT FILE THERE.
//TO DO: ADD PROGRESS BARS FOR CALL EVENTUALLY
//TO DO: Multithreading

const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 333
})

const bulk = ( answers ) => {
  prompt(cli.bulkQuestions).then(answers => {
    if(answers.csv_upload_confirm) {
      fs.readdir(csvCourses, (err, files) => {
        files.forEach(file => {
          let inputCrsFilePath = `${csvCourses}/${file}`
            fs.readdir(csvStrings, (err, files) => {
              files.forEach(file => {
                csv(answers)
                  .fromFile(inputCrsFilePath)
                  .then(async (courses) => { //ASYNC THIS FOR ALL THAT IS HOLY
                    for await (const course of courses) {
                      answers.courseNumber = course.canvas_course_id
                      fileGet(answers)
                    }
                })
              })
            })
        })
      })
    } else {
      console.log(`\n\nPlease place the input files in ${csvCourses} and ${csvStrings} and run the script again`)
      process.exit
    }
  })
}

const hLP = (link) => {
  p = parse(link)
  return p
}

const config = {
  method: 'GET',
  headers: {'Authorization': `Bearer ${token}`},
}

async function fileGet(answers) { 

  let domain          = answers.domain
  let courseNumber    = answers.courseNumber
  let searchString    = answers.search_string

  let init = `https://${domain}.instructure.com/api/v1/courses/${courseNumber}/files?search_term=${searchString}&per_page=100&only[]=names`
  
  function listGet ({url, payload = [], resolver = null}, config) {
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
      .catch(err => {
        console.error('this error', err)
      })
    })
  }

  listGet({url: init}, config)
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
      page_list = await listGet({url: initPage}, config)
      return page_list
    }
    async function disc_lister (initDisc) {
      disc_list = await listGet({url: initDisc}, config)
      return disc_list
    }
    async function assign_lister (initAssign) {
      assign_list = await listGet({url: initAssign}, config)
      return assign_list
    }
    const courseObj = {
      pages: await page_lister(initPage),
      discs: await disc_lister(initDisc),
      assign: await assign_lister(initAssign)
    }
    return courseObj
  })
  .then(courseObj => {
    // log(id_list.length)
    // log(courseObj.pages.length)
    log(courseObj.discs)
    // log(courseObj.assign.length)
  })
  .catch(error => {
    console.error(error)
  })
}
//function for calls that don't return body text e.g. pages
async function page_searcher (ids, items) {
  let files = ids
  let pages = items
  
  let pageUrl = `https://${domain}.instructure.com/api/v1/courses/${courseNumber}/pages/${pageId}`
  for await (page of pages) {
    pageId = page.id
    
  }


}
//function for calls that do return body text e.g. discussions, assignments, quizzes
async function local_searcher (ids, items) {

}
//let searchWord = new RegExp('[^\\s"]*' + searchString + '[^\\s"]*', "g");



// const files =(data, domain, courseNumber, searchString)=>{

//     let files = data

//     files.forEach(file=>{

//         let fileId = file.id
//         let fileUrl = `https://${domain}.instructure.com/api/v1/courses/${courseNumber}/files/${fileId}`

//         let headers = {
//             url: `${fileUrl}`,
//             headers: {Authorization: `Bearer ${token}`}
//         }

//         throttle(function() {
//             axios(headers).then(function(response){

//                 console.log(`course ${courseNumber} -- checking file:  ${fileId}`)

//                 // if(response.data.description !== null){

//                     let name = response.data.display_name.toLowerCase()
//                     let url = response.data.url
                
//                     // if(body !== null){
//                         let searchIndex = name.indexOf(searchString)
//                         if(searchIndex !== -1){
    
//                             let searchWord = new RegExp('[^\\s"]*' + searchString + '[^\\s"]*', "g");
//                             let matchedWords = name.match(searchWord);
//                             console.log(style.color.ansi16m.hex("#E06666") + `Found "${searchString}" at ${fileUrl}` + style.color.close)
//                             var nameNoComma = name.replace(new RegExp(/,/g), "_") //get rid of the comma for the CSV
//                             // for (i = 0; i < matchedWords.length; i++){
//                                   fs.appendFile(csvOutput, `${searchString}, ${nameNoComma}, ${fileId}, ${fileUrl}\n`, function(err) {});
//                                   // fs.appendFile(csvOutput, `${searchString}, ${nameNoComma}, ${fileUrl}, ${matchedWords[i]}\n`, function(err) {});
//                                   // console.log(style.color.ansi16m.hex("#E06666"), `${i+1}) ${matchedWords[i]}`, style.color.close)
//                             // }
//                         }
//                     // }
//                 //}

//             }).catch(function(error){console.log(style.color.ansi16m.hex("#EEEE66") + `files ERROR while scanning ${fileId} at: \n${fileUrl}` +  style.color.close)
//                     fs.appendFile(csvFailed, `${searchString}, ${fileId}, ${fileUrl}, files function error\n`, function(err) {});
//                     console.log(style.color.ansi16m.hex("#EEEE66"), error.response.data), style.color.close}
//                     )
//         })
//     })
// }


module.exports = { bulk }
