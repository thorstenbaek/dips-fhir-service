const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser")
const ndjson = require('ndjson')
const fs = require('fs');
const https = require('https');

const port = 80;

const app = express();

app.listen(port, () => {
   console.log(`Express listening on at port ${port}`)
});

let familyMemberHistory = 
[{
   "resourceType" : "FamilyMemberHistory",
   "identifier" : "123456", // External Id(s) for this record   
   "status" : "completed", // R!  partial | completed | entered-in-error | health-unknown
   "patient" : "Patient/1482713", // R!  Patient history is about   
   "name" : "Father", // The family member described
   "relationship" : 
      {
         "coding" : [{
            "code": "FTH"         
         }]
      }, 
   "sex" : "male",
   "extension" : [{
      "url": "http://fhir-registry.smarthealthit.org/StructureDefinition/family-history#height",
      "valueQuantity" : {
         "unit" : "cm",
         "system" : "http://unitsofmeasure.org",
         "value" : 201.123,
         "code" : "cm"
      }
   }]
 },
 {
   "resourceType" : "FamilyMemberHistory",
   "identifier" : "234567", // External Id(s) for this record   
   "status" : "completed", // R!  partial | completed | entered-in-error | health-unknown
   "patient" : "Patient/1482713", // R!  Patient history is about   
   "name" : "Mother", // The family member described
   "relationship" : 
      {
         "coding" : [{
            "code": "MTH"         
         }]
      }, 
   "sex" : "male",
   "extension" : [{
      "url": "http://fhir-registry.smarthealthit.org/StructureDefinition/family-history#height",
      "valueQuantity" : {
         "unit" : "cm",
         "system" : "http://unitsofmeasure.org",
         "value" : 166.321,
         "code" : "cm"
      }
   }]
 }];

function loadObservations()
{
   const numberOfObservationFiles = 17;
   var filesLoaded = 0;

   console.log(`Loading observations from ${numberOfObservationFiles} ndjson files`);
   for(var i = 1; i <= numberOfObservationFiles; i++)
   {      
      fs.createReadStream(`./fhir-data/${i}.Observation.ndjson`)
      .pipe(ndjson.parse())
      .on('data', function(data){
         observations.push(data)         
      })
      .on('end', function(){
         filesLoaded++;
         if (filesLoaded == numberOfObservationFiles)
         {
            console.log(`Loaded ${observations.length} observations`)
         }
      });
   }   
}

var observations = [];
loadObservations();

var patients = [];
fs.createReadStream('./fhir-data/1.Patient.ndjson')
   .pipe(ndjson.parse())
   .on('data', function(data){
      patients.push(data);
   });

var corsOptions = 
{
    "credentials": "true",
    "allowedHeaders": "origin, authorization, accept, content-type, x-requested-with",    
    "methods": "GET, HEAD, POST, PUT, DELETE, TRACE, OPTIONS",
    "origin": "*"    
}

let SecurityServiceUri = null;

app.use(cors(corsOptions));
app.use(bodyParser.json());

app.use((req, res, next) => {       
    console.log(`${req.method}: ${req.originalUrl}`);
    next();
});

app.get("/Patient", (req, res) => {

   var response = {
      resourceType: "Bundle",
      entry: patients.map(patient => 
         {
            var entry = 
            {
               fullUrl: `${req.protocol}://${req.headers.host}${req.path}/${patient.id}`,
               resource: patient
            }
            
            return entry;
         })
   };

   res.send(response);
});

app.get("/Patient/:patientId", (req, res) => {        
    var patient = patients.filter(o => o.id === req.params.patientId);    
    res.send(patient[0]);

})

app.get("/Observation", (req, res) => {
   var filtered = observations.filter(o => o.subject.reference === "Patient/" + req.query.patient);

   console.log("Found observations: " + filtered.length);

   res.send(filtered);    
})

app.get("/FamilyMemberHistory", (req, res) => {
    console.log(req.query);
    res.send(familyMemberHistory);    
})

async function LoadConfig()
{
   var environment = process.env.ENVIRONMENT;
   var configurationServiceUri = process.env.CONFIGURATION_SERVICE_URI;

   console.log(`Loading Config for environment ${environment}`);
   
   var options = {
      host: ConfigurationServiceUri, 
      port: 443,
      path: `/Setting/${environment}/SecurityServiceUri`,
      method: 'GET',
      rejectUnauthorized: false,
      requestCert: true,
      agent: false
    };

   https.get(options, res => {
      res.on("data", data => {
         SecurityServiceUri = data;      
         console.log("SecurityServiceUri :" + SecurityServiceUri);

         loadMetadata();
         loadWellknown();   

         console.log(`Finished loading Config`);
      });
   });
}
LoadConfig();

async function loadMetadata()
{
   console.log("Loading Metadata...");

   let rawdata = fs.readFileSync('./fhir-data/metadata.json');
   rawdata = rawdata.toString();
   rawdata = replaceAll(rawdata, "${SecurityServiceUri}", SecurityServiceUri);   

   metadata = JSON.parse(rawdata);
}

var metadata;
app.get("/metadata", (req, res) => {   
   res.send(metadata);
})

/* Define function for escaping user input to be treated as 
    a literal string within a regular expression */
    function escapeRegExp(string){
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
      
  /* Define functin to find and replace specified term with replacement string */
  function replaceAll(str, term, replacement) {
      return str.replace(new RegExp(escapeRegExp(term), 'g'), replacement);
  }

async function loadWellknown()
{
   console.log("Loading Wellknown...");
   
   let rawdata = fs.readFileSync('./fhir-data/wellknown.json');
   rawdata = rawdata.toString();
   rawdata = replaceAll(rawdata, "${SecurityServiceUri}", SecurityServiceUri);   

   wellKnown = JSON.parse(rawdata);
}

var wellKnown;
app.get("/.well-known/smart-configuration", (req, res) => {
   res.send(wellKnown);
})

app.get("/environment", (req, res) => {
   res.send(process.env.ENVIRONMENT);
})