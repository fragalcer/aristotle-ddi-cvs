const axios = require('axios')
const handlebars = require('handlebars')
const fs = require('fs')
const util = require('util')

const baseurl = 'https://ddi-alliance.aristotlecloud.io/api/graphql/api';
const uuid_regex = new RegExp('^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')

// Convert fs.readFile into Promise version   
// Thanks to https://stackoverflow.com/a/46867579
const readFile = util.promisify(fs.readFile);

exports.lambdaHandler = async (event, context) => {

  // Get uuid
  var uuid = event.pathParameters.uuid

  // Validate uuid
  if (uuid === undefined) {
    console.log('No uuid provided')
    return {
      statusCode: 404,
      body: 'No uuid provided'
    }
  }

  var valid = uuid_regex.test(uuid)
  if (!valid) {
    console.log('invalid uuid')
    return {
      statusCode: 404,
      body: 'invalid uuid'
    }
  }

  // Build graphql query
  var query = `query {
    valueDomains (uuid: "${uuid}") {
      edges {
        node {
          uuid
          name
          definition
          version
          conceptualDomain {
            name
            definition
            comments
            originUri
            ConceptPtr {
              slots {
                edges {
                  node {
                    name
                    value
                  }
                }
              }
              identifiers {
                identifier
                version
              }
            }
          }
          permissiblevalueSet {
            value
            valueMeaning {
              name
              definition
            }
          }
          supplementaryvalueSet {
            value
            valueMeaning {
              name
              definition
            }
          }
        }
      }
    }
  }`
  
  // Read xml template file
  var ddi_template_string
  try {
    ddi_template_string = await readFile('ddi-template.xml', {encoding: 'utf-8'})
  } catch(err) {
    console.log(err);
    return {
      statusCode: 404,
      body: 'Not Found'
    }
  }

  // Compile handlebars template
  var template = handlebars.compile(ddi_template_string)
  
  // axios options
  var options = {
    params: {
      raw: true,
      query: query  
    }
  }
  
  // Perform graphql query
  var result
  try {
    result = await axios(baseurl, options);
  } catch (err) {
    console.log(err.message)
    return {
      statusCode: 404,
      body: err.message
    }
  }

  // Setup context
  var context = result.data.data.valueDomains.edges[0].node

  var cdslots = {}
  var edges = context.conceptualDomain.ConceptPtr.slots.edges
  for (var edge of edges) {
    cdslots[edge.node.name] = edge.node.value
  }
  context.conceptualDomain.slots = cdslots

  context.conceptualDomain.identifier = context.conceptualDomain.ConceptPtr.identifiers[0]
  
  // Render template
  xml_response = template(context)

  // Return response
  response = {
    statusCode: 200,
    body: xml_response
  }
  return response
};
