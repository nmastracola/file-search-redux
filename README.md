### White Glove Migration Scripts

This repository is a collection of scripts that the Instructure White Glove 
Migrations Team uses to quickly clean up content inside of Canvas courses.  Please note 
that these scripts are not supported by Instructure and that any issues that may be caused 
by these scripts will not be fixed by anyone at Instructure.  Please use at your own risk.

### Setup

This script uses Node.js.

### Find Script

The first script simply looks for a string in all content pages within a specified course.  Findings are outputted 
to a CSV file inside of the 'logs' directory.

### Find and Replace

The Find and Replace script searches for all instances of a word inside of content pages and replaces it with a new word.

### Create Assignments

The Creation script automatically creates assignments and requires you to place a prebuilt assignment csv into the directory in `/logs/assignmentCreation`

### Course Settings

This requires you to upload a "provisioning report" csv file that you can download from your account settings page into the "input" 
directory found inside of `/logs/courseSettings/input`.
