    
const { prompt } = require('enquirer');
const cli = require("./config/cli-questions")

////// HANDLERS //////////
const bulkSearch  = require("./handlers/bulkFileSearch/bulkFileSearch.js")
 
prompt(cli.questions)
  .then(answers =>{
    if(answers.script === 'Bulk File Search'){
        bulkSearch.bulk(answers)
    }
  })
  .catch(console.error);
