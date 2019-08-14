module.exports = {
  bulkQuestions: [
    {
      type: 'input',
      name: 'domain',
      message: 'What is the school domain?'
    }, 
    {
      type: 'input',
      name: 'search_string',
      message: 'What string are you searching for?'
    },
    {
      type: 'confirm',
      name: 'csv_upload_confirm',
      message: 'Did you place your csv files into "/logs/bulkFind/input"?'
    },
  ]
}