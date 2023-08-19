This folder contains a set of code tools built to handle phenology data related to galls. 

The functions that do most of the work are either stored in a library file that is be sourced on startup in the file that needs them or just included in the relevant script.

The key file is "gallphenReset.sqlite". This is the most recent copy of the phenology db. 

If you got a new copy of the gallformers database and want to make the phenology database consistent with it, use migration script.R

To get new data from inaturalist observations, use inat obs importer.R. The annotations there should walk you through the procedure. If you need to change the functions, they're in iNatImportFunctions.R

If you find there's some mistaken or out of date information in the db file, there's brief code written up to help with that in DataFix.R, although they're pretty generic SQL queries

To update the web tool after you've added or corrected some data, go to UpdatePhenoTool.R and run the code there to extract and process the dataframe and upload to shinyapps.io. That's it!

Bulk updating iNat observations:
To get a list of all cynipini species for which only agamic or sexgen or both are known, use subset cynipini by gen.R

Once you have those lists, you can use Batch API updates.R to run a mapply loop that applies generation to every Research Grade iNat observation where only one generation is known. 
This will never overwrite an existing OF value, but it may add inappropriate data if you don't check the observations first and there are misID'd RG observations, and it will probably take a long time to run. 
Nothing bad will happen if you interrupt it and start over. 

