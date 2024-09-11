#functions

# checks to see when a species (by iNat code) was last updated 
datecheck <- function(code){
  if (grepl("-",code,fixed=TRUE)){
    return(dbGetQuery(gallphen, str_interp("SELECT update_date FROM specieshistory WHERE species_id = (SELECT species_id FROM species WHERE species LIKE '${code}')")))
  } else {
    return(dbGetQuery(gallphen, str_interp("SELECT update_date FROM specieshistory WHERE species_id = (SELECT species_id FROM species WHERE inatcode = '${code}')")))
  }
}

# takes either an iNat species code or a gallformers code and makes an iNat API query url 
# only fetches observations uploaded after the last update date for the species 
urlMaker <- function(code) {
  
  if (grepl("-",code,fixed=TRUE)){
    
    url <-
      str_interp(
        "https://api.inaturalist.org/v1/observations?quality_grade=research&verifiable=true&identifications=any&page=1&place_id=6712%2C1&per_page=200&order=desc&order_by=created_at&any&field%3Agallformers%2Bcode=${code}"
      )
  } else {
    #checks to see if the code matches anything in the db
    match <- dbGetQuery(gallphen, str_interp("SELECT * FROM species WHERE inatcode = '${code}'"))
    if (dim(match)[1]==0) { 
      warning("iNat code does not exist in the database; please add it first")
    } else {
      
      url <-
        str_interp(
          "https://api.inaturalist.org/v1/observations?quality_grade=research&identifications=any&page=1&place_id=6712%2C1&per_page=200&order=desc&order_by=created_at&taxon_id=${code}"
        )  
    }
  }
  return(url)
}

#calls the iNat API and parses JSON into a dataframe, with a few other processing steps
iNatCall <- function(url) {
  
  ### Get annotation codes
  a <- fromJSON("https://api.inaturalist.org/v1/controlled_terms")
  a <- flatten(a$results)
  l <- lapply(seq_along(a[, "values"]), function(i) {
    cbind(idann = a$id[i], labelann = a$label[i], a[i, "values"][[1]][, c("id", "label")])
  })
  ann <- do.call("rbind", l)
  ann
  
  keep <-
    c("id", "observed_on","taxon.name", "location", "uri","ofvs","annotations","place_ids") # values to keep
  
  nobs <- NULL
  while(is.null(nobs)){
    nobs <- tryCatch(fromJSON(url),
                     error = function(e)
                       return(NULL))
    Sys.sleep(1)}
  
  npages <- ceiling(nobs$total_results / 200)
  xout <- flatten(nobs$results)
  xout <- xout[,keep]
  x <- NULL
  
  if (npages>1){
    for(i in 2:npages) {
      # Get json and flatten
      page <- paste0("&page=", i)
      while (is.null(x)){
        x <- tryCatch(fromJSON(gsub("&page=1", page, url)),
                      error = function(e)
                        return(NULL))
        Sys.sleep(1)}
      x <- flatten(x$results)
      x1 <- x[,keep]
      xout <- rbind(xout,x1)
      x <- NULL
    }}
  
  x <- xout
  
  
  
  ### Extract annotations if any
  vals <- lapply(seq_along(x$annotations), function(i) {
    j <- x$annotations[[i]]
    n <- c("controlled_attribute_id", "controlled_value_id")
    if (all(n %in% names(j))) {
      # tests if there are any annotations for the obs
      ans <- j[, n]
    } else{
      ans <-
        data.frame(x = NA, y = NA) # if no annotations create NA data.frame
      names(ans) <- n
    }
    cbind(x[i, keep][rep(1, nrow(ans)),], ans) # repeat obs for each annotation value and bind with ann
  })
  vals <- do.call("rbind", vals) # bind everything
  
  keep <-
    c(
      "id",
      "observed_on",
      "taxon.name",
      "location",
      "uri",
      "ofvs",
      "place_ids",
      "controlled_attribute_id",
      "controlled_value_id"
    ) # values to keep
  
  ### Extract observation fields if any
  
  of <- lapply(seq_along(vals$ofvs), function(i) {
    f <- vals$ofvs[[i]]
    m <- c("name", "value")
    if (all(m %in% names(f))) {
      # tests if there are any annotations for the obs
      ans <- f[, m]
    } else{
      ans <-
        data.frame(x = NA, y = NA) # if no annotations create NA data.frame
      names(ans) <- m
    }
    cbind(vals[i, keep][rep(1, nrow(ans)),], ans) # repeat obs for each annotation value and bind with ann
  })
  
  of <- do.call("rbind", of) # bind everything
  
  of$country <- sapply(of$place_ids,"[[",1)
  of$place_ids <- NULL
  of$country <- gsub("6712","Canada",of$country)
  of$country <- gsub("1","USA",of$country)
  
  ## Merge obs with annotations
  obs <-
    merge(
      of,
      ann,
      by.x = c("controlled_attribute_id", "controlled_value_id"),
      by.y = c("idann", "id"),
      all.x = TRUE
    )
  obs <- obs[order(obs$id), ]
  
  ### Cast from long to wide and concatenate annotation values
  # Results in a single line per obs
  setDT(obs) # turn df to data.table to use dcast
  obs <- dcast(
    obs,
    id + uri + observed_on + location + country + taxon.name + name + value ~ labelann,
    value.var = "label",
    fun = function(i) {
      paste(i, collapse = "; ")
    }
  )
  names(obs) <- gsub(" ", "_", names(obs)) # remove spaces from column names
  # setDT(obs) # turn df to data.table to use dcast
  if (is.null(obs$Evidence_of_Presence)){
    obs$Evidence_of_Presence <- NA
  } else {
    obs$Evidence_of_Presence <- obs$Evidence_of_Presence
  }
  if (is.null(obs$Life_Stage)){
    obs$Life_Stage <- NA
  } else {
    obs$Life_Stage <- obs$Life_Stage
  }
  if (is.null(obs$Plant_Phenology)){
    obs$Plant_Phenology <- NA
  } else {
    obs$Plant_Phenology <- obs$Plant_Phenology
  }
  
  obs <- dcast(
    obs,
    id + uri + observed_on + location + taxon.name + country + Evidence_of_Presence + Life_Stage + Plant_Phenology ~ name,
    value.var = "value",
    fun = function(i) {
      paste(i, collapse = "; ")
    }
  )
  names(obs) <- gsub(" ", "_", names(obs)) # remove spaces from column names
  
  obs <- select(obs, one_of(c("id","observed_on", "country","taxon.name","location","uri","Plant_Phenology","Evidence_of_Presence","Life_Stage","Gall_generation","Gall_phenophase","Host_Plant_ID","Rearing_viability")))
  
  ## process variables
  obs <- obs %>% separate(location, c("latitude","longitude"), ",")
  obs$doy <- yday(obs$observed_on)
  obs <- Filter(function(x)!all(is.na(x)),obs)
  return(as.data.frame(obs))
}


get_annotation_codes <- function() {
  a <- fromJSON("https://api.inaturalist.org/v1/controlled_terms")
  a <- flatten(a$results)
  l <- lapply(seq_along(a[, "values"]), function(i) {
    cbind(idann = a$id[i], labelann = a$label[i], a[i, "values"][[1]][, c("id", "label")])
  })
  ann <- do.call("rbind", l)
  return(ann)
}

fetch_data <- function(url) {
  tryCatch(fromJSON(url),
           error = function(e) {
             warning("Error while fetching data: ", e$message)
             return(NULL)
           })
}







# checks to see if observations are in the baddata table or already in the observations table; outputs a new dataframe without those observations
checkData <- function(df){
  remove <- 1:dim(df)[1]
  id <- NA
  remove <- as.data.frame(cbind(remove, id))
  for (i in 1:dim(df)[1]) {
    bad <- dbGetQuery(gallphen, str_interp("SELECT 1 FROM baddata WHERE obs_id = '${df$id[i]}'"))
    hyperlink <- df$uri[i]
    inatid <- sub(".*/", "", hyperlink)
    exist <- dbGetQuery(gallphen, str_interp("SELECT 1 FROM observations WHERE pageURL LIKE '%${inatid}%'"))
    
    if (dim(bad)[1]!=0||dim(exist)[1]!=0) {
      remove$id[i] <- df$id[i]
    } 
  }
  df <- df[!(df$id %in% remove$id),]
  warning(str_interp("${length(remove[!is.na(remove$id),1])} observations have been removed as duplicates or bad data"))
  return(df)
}

# creates a subset of the data that are missing key values
findMissing <- function(df){
  if (!is.null(df$Plant_Phenology)){
    miss1 <- df[df$Plant_Phenology=="",]
  }  else {miss1 <- NULL}
  if (!is.null(df$Gall_generation)){
    miss2 <- df[df$Gall_generation=="",]
  } else {miss2 <- NULL}
  if (!is.null(df$Gall_phenophase)){
    miss3 <- df[df$Gall_phenophase=="",]
  } else {miss3 <- NULL}
  missing <- rbind(miss1,miss2,miss3)
  missing <- missing[!(missing$Evidence_of_Presence == "Organism" & missing$Life_Stage == "Adult"),]
  if (dim(unique(missing))[1]>20){
    warning("Many data points are missing values. You may want to go to iNat and fill them in and run the import function again rather than using this tool to fix them individually")
  }
  return(unique(missing))
}

# creates a subset of the data that are marked Life stage egg
findEgg <- function(df){
  if (!is.null(df$Life_Stage)){
    egg <- df[df$Life_Stage=="Egg",]
  }
  return(egg)
}

numbers_only <- function(x) {!grepl("\\D", x)}
# looks up all host IDs in the db and prints the ones not in the db yet
checkHost <- function(df){
  
  hostcodes <- unique(df$Host_Plant_ID)
  host_id <- NA
  hosts <- as.data.frame(cbind(hostcodes, host_id))
  
  hosts <- hosts[!hosts$hostcodes=="",]
  
  for (i in 1:dim(hosts)[1]){
    if (numbers_only(hosts$hostcodes[i])){
      rank <- dbGetQuery(gallphen, str_interp("SELECT taxonRank FROM inatcodes WHERE id = '${hosts$hostcodes[i]}' "))
      if (isTRUE(rank[1,1]=="species")){
        hosts$host_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE inatcode = '${hosts$hostcodes[i]}'"))
      } else {
        hosts$host_id[i] <- NA
      }
    } else {
      if (!grepl("'", hosts$hostcodes[i])){
        hosts$host_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE inatcode = (SELECT id FROM commonnames WHERE vernacularName LIKE '%${hosts$hostcodes[i]}%')"))
      } else {
        hosts$host_id[i] <- NA
      }
    }
    
  }
  
  
  hosts <- hosts[numbers_only(hosts$host_id),]
  hosts <- hosts[hosts$host_id=="integer(0)",]
  if (dim(hosts)[1]!=0){
    hosts$uri <- paste0("https://www.inaturalist.org/taxa/",hosts$hostcodes)
    for (i in 1:20){
      browseURL(unique(hosts$uri[i]))
    }
  }
  return(hosts)
}

# this function renames columns and adds columns as needed go from the output of the iNat export to the input to the database.  
# Only works if column inputs are not altered

#this is the refactored version
clean_and_transform <- function(df) {
  df$id <- NULL
  names(df)[names(df) == "observed_on"] <- "date"
  df$latitude <- as.numeric(df$latitude)
  df$longitude <- as.numeric(df$longitude)
  names(df)[names(df) == "uri"] <- "pageURL"
  names(df)[names(df) == "Life_Stage"] <- "lifestage"
  names(df)[names(df) == "Rearing_viability"] <- "viability"
  df$Evidence_of_Presence <- NULL
  df$site <- NA
  df$state <- NA
  df$sourceURL <- "inaturalist.org"
  
  # Handle NAs
  cols_to_check <- c("lifestage", "country", "doy", "AGDD32", "AGDD50", "yearend32", "yearend50", "percent32", "percent50", "viability")
  for (col in cols_to_check) {
    if (is.null(df[[col]])) {
      df[[col]] <- NA
    }
  }
  
  # Handle 'doy' specifically
  if (is.null(df$doy)) {
    df$doy <- yday(df$date)
  }
  
  return(df)
}

separate_taxon_name <- function(df) {
  df <- df %>% separate(taxon.name, c("genus", "species"), remove = TRUE, extra = "drop")
  return(df)
}

assign_host_id_verbose <- function(df, gallphen) {
  # Check if 'Host_Plant_ID' column exists
  if ("Host_Plant_ID" %in% names(df)) {
    unique_host_ids <- unique(df$Host_Plant_ID[!is.na(df$Host_Plant_ID)])
  } else {
    # If 'Host_Plant_ID' column doesn't exist, create an empty 'host_id' column and return the dataframe
    df$host_id <- NA
    return(df)
  }
  
  host_id_results <- list()
  host_to_species_map <- list()
  
  # Initialize host_to_species_map
  for (host_id in unique_host_ids) {
    host_to_species_map[[host_id]] <- 0
  }
  
  # Query database for unique Host_Plant_IDs
  for (host_id in unique_host_ids) {
    if (numbers_only(host_id)) {
      query <- str_interp("SELECT species_id, genus, species FROM species WHERE inatcode = '${host_id}'")
    } else {
      query <- str_interp("SELECT species_id, genus, species FROM species WHERE inatcode = (SELECT id FROM commonnames WHERE vernacularName LIKE '%${host_id}%')")
    }
    result <- dbGetQuery(gallphen, query)
    
    if (nrow(result) == 0) {
      message("Missing counterpart in DB for Host_Plant_ID: ", host_id)
      next
    }
    
    species_name <- paste(result$genus, result$species)
    host_id_results[[host_id]] <- list("species_id" = result$species_id[1], "species_name" = species_name)
  }
  
  # Assign host_id values to the dataframe and update host_to_species_map
  df$host_id <- NA
  for (i in 1:nrow(df)) {
    current_host_id <- df$Host_Plant_ID[i]
    if (!is.na(current_host_id)) {
      if (!is.null(host_id_results[[current_host_id]])) {
        df$host_id[i] <- host_id_results[[current_host_id]]$species_id
        host_to_species_map[[current_host_id]] <- host_to_species_map[[current_host_id]] + 1
      } else {
        if (is.null(host_to_species_map[[current_host_id]])) {
          host_to_species_map[[current_host_id]] <- 1
        } else {
          host_to_species_map[[current_host_id]] <- host_to_species_map[[current_host_id]] + 1
        }
      }
    }
  }
  
  # Verbose output for species count, skipping unknowns
  for (host_id in names(host_to_species_map)) {
    if (!is.null(host_id_results[[host_id]]) && host_id_results[[host_id]]$species_name != "Unknown") {
      species_name <- host_id_results[[host_id]]$species_name
      message("Host_Plant_ID: ", host_id, " -> Species: ", species_name, " (Observation Count: ", host_to_species_map[[host_id]], ")")
    }
  }
  
  return(df)
}

assign_gall_id_verbose <- function(df, gallphen) {
  # Check if required columns exist
  required_columns <- c("genus", "species")
  missing_columns <- setdiff(required_columns, names(df))
  
  if (length(missing_columns) > 0) {
    stop("Required column(s) missing from dataframe: ", paste(missing_columns, collapse = ", "))
  }
  
  # Check if Gall_generation column exists, if not, create it with NA values
  if (!"Gall_generation" %in% names(df)) {
    warning("Gall_generation column not found. Creating it with NA values.")
    df$Gall_generation <- NA
  }
  
  # Preprocess Gall_generation
  df$Gall_generation <- ifelse(is.na(df$Gall_generation), "", as.character(df$Gall_generation))
  df$Gall_generation <- gsub("unisexual", "agamic", df$Gall_generation)
  df$Gall_generation <- gsub("bisexual", "sexgen", df$Gall_generation)
  
  # Extract unique combinations
  unique_combinations <- unique(df[, c("genus", "species", "Gall_generation")])
  
  # Prepare a list to store query results
  gall_id_results <- list()
  
  # Query database for each unique combination
  for (i in 1:nrow(unique_combinations)) {
    row <- unique_combinations[i, ]
    gall_id_query <- if (row$Gall_generation != "") {
      str_interp("SELECT species_id FROM species WHERE genus = '${row$genus}' AND species LIKE '%${row$species}%' AND generation LIKE '%${row$Gall_generation}%'")
    } else {
      str_interp("SELECT species_id FROM species WHERE genus = '${row$genus}' AND species = '${row$species}'")
    }
    result <- tryCatch(
      dbGetQuery(gallphen, gall_id_query),
      error = function(e) {
        warning("Database query failed for ", paste(row, collapse = " "), ": ", e$message)
        return(data.frame(species_id = numeric(0)))
      }
    )
    if (nrow(result) > 0) {
      key <- paste(row$genus, row$species, row$Gall_generation, sep = "_")
      gall_id_results[[key]] <- as.numeric(result$species_id[1])
    }
  }
  
  # Initialize a counter for each species
  species_counter <- setNames(rep(0, length(gall_id_results)), names(gall_id_results))
  
  # Assign gall_id to the dataframe
  df$gall_id <- NA
  for (i in 1:nrow(df)) {
    key <- paste(df$genus[i], df$species[i], df$Gall_generation[i], sep = "_")
    if (!is.null(gall_id_results[[key]])) {
      df$gall_id[i] <- gall_id_results[[key]]
      species_counter[[key]] <- species_counter[[key]] + 1
    } else {
      warning("No gall id found for row ", i)
    }
  }
  
  # Verbose output for species and gall count
  for (key in names(species_counter)) {
    if (species_counter[[key]] > 0) {
      message("Species: ", gsub("_", " ", key), " (Gall Observation Count: ", species_counter[[key]], ")")
    }
  }
  
  return(df)
}

assign_phenophase <- function(df) {
  # Check if 'Plant_Phenology' or 'Gall_phenophase' exist and rename to 'phenophase'
  if("Plant_Phenology" %in% names(df)) {
    names(df)[names(df) == "Plant_Phenology"] <- "phenophase"
  } else if("Gall_phenophase" %in% names(df)) {
    names(df)[names(df) == "Gall_phenophase"] <- "phenophase"
  } else {
    # If neither exists, add a 'phenophase' column with NA values
    df$phenophase <- NA
  }
  
  # Fill empty 'phenophase' values with 'lifestage' values
  for (i in 1:nrow(df)) {
    if (is.na(df$phenophase[i]) || df$phenophase[i] == "") {
      df$phenophase[i] <- df$lifestage[i]
    }
  }
  
  # Remove specific columns
  df$genus <- NULL
  df$species <- NULL
  df$Gall_generation <- NULL
  df$Host_Plant_ID <- NULL
  
  return(df)
}



#the original version just in case
PrepAppendOld <- function(x){
  
  x$id <- NULL
  names(x)[names(x)=="observed_on"] <- "date"
  # x$date <- as.Date(x$date)
  x$latitude <- as.numeric(x$latitude)
  x$longitude <- as.numeric(x$longitude)
  names(x)[names(x)=="uri"] <- "pageURL"
  names(x)[names(x)=="Life_Stage"] <- "lifestage"
  names(x)[names(x)=="Rearing_viability"] <- "viability"
  x$Evidence_of_Presence <- NULL
  x$site <- NA
  x$state <- NA
  x$sourceURL <- "inaturalist.org"
  if (is.null(x$lifestage)){
    x$lifestage <- NA
  }
  if (is.null(x$country)){
    x$country <- NA
  }
  if (is.null(x$doy)){
    x$doy <- yday(x$date)
  }
  if (is.null(x$AGDD32)){
    x$AGDD32 <- NA
  }
  if (is.null(x$AGDD50)){
    x$AGDD50 <- NA
  } 
  if (is.null(x$yearend32)){
    x$yearend32 <- NA
  }
  if (is.null(x$yearend50)){
    x$yearend50 <- NA
  } 
  if (is.null(x$percent32)){
    x$percent32 <- NA
  }
  if (is.null(x$percent50)){
    x$percent50 <- NA
  } 
  if (is.null(x$viability)){
    x$viability <- NA
  } 
  
  x <- x %>% separate(taxon.name, c("genus","species"), remove=TRUE, extra = "drop")
  
  # if this is a plant dataset, get the corresponding species IDs for a host and make a blank gall_id column
  if (!is.null(x$Plant_Phenology)){
    
    for (i in 1:dim(x)[1]){
      x$host_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE genus = '${x$genus[i]}' AND species = '${x$species[i]}'"))
    }
    x$host_id <- as.numeric(x$host_id)
    x$gall_id <- NA
  } else {
    # if this is a gall dataset, if no host data exists, make a blank host_id column, otherwise get the corresponding species IDs for each host
    if (is.null(x$Host_Plant_ID)){
      x$host_id <- NA
      
    } else {
      
      for (i in 1:dim(x)[1]){
        if (is.na(x$Host_Plant_ID[i])) {
          x$host_id[i] <- NA
        } else {
          if (numbers_only(x$Host_Plant_ID[i])){
            rank <- dbGetQuery(gallphen, str_interp("SELECT taxonRank FROM inatcodes WHERE id = '${x$Host_Plant_ID[i]}' ")) 
            if (isTRUE(rank[1,1]=="species")){
              x$host_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE inatcode = '${x$Host_Plant_ID[i]}'"))
            } else {
              x$host_id[i] <- NA
            } 
          } else { 
            if (!grepl("'", x$Host_Plant_ID[i])){
              x$host_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE inatcode = (SELECT id FROM commonnames WHERE vernacularName LIKE '%${x$Host_Plant_ID[i]}%')"))
            } else {
              x$host_id[i] <- NA
            }
          }
        }
        
        if (!numbers_only(x$host_id[i])){
          x$host_id[i] <- NA
        }
      }
    }
    x$host_id <- as.numeric(x$host_id)
    #if the generation is tagged, get gall_id for each accordingly
    # x$gall_id <- "1154"
    
    
    if (is.null(x$Gall_generation)){
      for (i in 1:dim(x)[1]){
        x$gall_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE genus = '${x$genus[i]}' AND species = '${x$species[i]}'"))
      }
    } else {
      x$Gall_generation <- gsub("unisexual","agamic", x$Gall_generation)
      x$Gall_generation <- gsub("bisexual","sexgen", x$Gall_generation)
      for (i in 1:dim(x)[1]){
        x$gall_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE genus = '${x$genus[i]}' AND species LIKE '%${x$species[i]}%' AND generation LIKE '%${x$Gall_generation[i]}%'"))
      }
    }
    warning(paste0( dim(x[(x$gall_id=="integer(0)"), ])[1]  ), " rows have been removed because no gall id was found")
    x <- x[!(x$gall_id=="integer(0)"), ]
    warning(paste0(dim(x[grepl(",", x$gall_id), ])[1]), " rows have been removed because multiple gall ids were found")
    x <- x[!grepl(",", x$gall_id), ]
    # x[grepl(",", x$gall_id), "gall_id"] <- 1680
    x$gall_id <- as.numeric(x$gall_id)
  }
  
  names(x)[names(x)=="Plant_Phenology"] <- "phenophase"
  names(x)[names(x)=="Gall_phenophase"] <- "phenophase"
  
  # if there was no gall phenophase, the observation is assumed to be a free-living adult and the Adult from lifestage is pasted in to phenophase
  for (i in 1:dim(x)[1]){
    if (isTRUE(x$phenophase[i]=="")){
      x$phenophase[i] <- x$lifestage[i]
    } 
  }
  
  x$genus <- NULL
  x$species <- NULL
  # names(x)[names(x)=="Gall_generation"] <- "generation"
  x$Gall_generation <- NULL
  x$Host_Plant_ID <- NULL
  return(as.data.frame(x))
  
}

# functions to calculate a new column for the accumulated hours (adjusted for latitude) and the percent of same (seasonality index) of each observation in a dataframe
# must contain a latitude and doy column
pos_part <- function(x) {
  return(sapply(x, max, 0))
}

eqmod = function(x,lat=49) {((2*(24/(2*pi))*acos(-tan((lat*pi/180))*tan((pi*Declination(x-(1.8*lat-50) )/180))))-(0.1*lat+5)) }

acchours <- function(x){
  
  for (i in 1:dim(x)[1]){
    x$acchours[i] <- trapz(
      seq(1,x$doy[i]),
      (pos_part(eqmod(seq(1,x$doy[i]),x$latitude[i])*(90-x$latitude[i]))
       /max(eqmod(seq(1,365),x$latitude[i])) * (-1/200*x$latitude[i]+647/600) )  
    )
  }
  return(x)
}

eq = function(x,lat=49) {((2*(24/(2*pi))*acos(-tan((lat*pi/180))*tan((pi*Declination(x)/180))))-(0.1*lat+5)) }

seasonIndex <- function(x){
  
  for (i in 1:dim(x)[1]){
    x$seasind[i] <- trapz(seq(1,x$doy[i]),(pos_part(eq(seq(1,x$doy[i]),x$latitude[i]))))/trapz(seq(1,(365)),(pos_part(eq(seq(1,(365)),x$latitude[i]))))
  }
  return(x)
}





# wraps doy around the new year for agamic galls that start in fall and emerge next spring
doywrap <- function(x){
  sub <- x[!x$generation=="sexgen",]
  sub$phenostage <- paste0(sub$phenophase, sub$lifestage)
  sub <- sub[!sub$phenophase=="senescent",]
  sub <- sub[!sub$phenostage=="",]
  sub <- sub[!sub$phenophase=="developing",]
  sub <- sub[!sub$phenophase=="dormant",]
  
  if (min(sub$doy)<65&&max(sub$doy)>300){
    for (i in 1:dim(x)[1]){
      if (x$generation[i]!="sexgen"&&x$doy[i]<200&&x$phenophase[i]!="developing"&&x$phenophase[i]!="oviscar"){
        x$doy[i] <- x$doy[i]+365
        x$seasind[i] <- x$seasind[i]+1
      }
    }
  }
  return(x)
}

# calculates the slope and y intercept of the lines representing two sds above and below the mean accumulated day hours or seasonality index of flower budding or maturing, adult, perimature observations
# old version using mean and sd
# parcalc <- function(x,y,var){
#   y <- distinct(y[,-c(1:4,7:8,12:15)])
#   m <- mean(x[[var]],na.rm=TRUE)
#   s <- sd(x[[var]],na.rm=TRUE)
#   if (is.na(s)){
#     if (var=="acchours"){
#       s <- 500
#     } else {
#       s <- .1
#     }
# 
#   }
#   print(m)
#   print(s)
#   z <- 1.25
#   thr <- 0.025*m
#   print((m)-(z*s))
#   tf <- y[which(between(y[[var]],((m-thr)-(z*s)),((m+thr)-(z*s))  )),]
#   print(dim(tf)[1])
#   if (dim(tf)[1]>1){
#     mod <- lm(tf$latitude~tf$doy)
#     plot(tf$latitude~tf$doy)
#     low <- coefficients(mod)
#   } else {
#     low <- c(-9999,0)
#   }
#   z <- 2.2
#   print(((m)+(z*s)))
#   tf <- y[which(between(y[[var]],((m-thr)+(z*s)),((m+thr)+(z*s))  )),]
#   print(dim(tf)[1])
#   if (dim(tf)[1]>1){
#     mod <- lm(tf$latitude~tf$doy)
#     plot(tf$latitude~tf$doy)
#     high <- coefficients(mod)
#   } else {
#     high <- c(-9999,0)
#   }
#   
#   coef <- rbind(low,high)
#   return(as.data.frame(coef))
# }
# new version using median and IQR
parcalc <- function(x,y,var){
  y <- distinct(y[,-c(1:4,7:8,12:15)])
  quant <- quantile(x[[var]], probs=c(.05,.5,.95))
  
  q1 <- quant[1]
  m <- quant[2]
  q3 <- quant[3]
  
  # m <- mean(x[[var]],na.rm=TRUE)
  # s <- sd(x[[var]],na.rm=TRUE)
  # if (is.na(s)){
  #   if (var=="acchours"){
  #     s <- 500
  #   } else {
  #     s <- .1
  #   }
  #   
  # }
  # print(m)
  # print(s)
  q1 <- 1.001
  thr <- 0.05*m
  tf <- y[which(between(y[[var]],(q1-thr),(q1+thr)  )),]
  tf$dist <-  abs(tf[[var]]-q1)
  quantile(tf$dist)[4]
  tf <- tf[!(tf$dist>quantile(tf$dist)[4]),]
  print(dim(tf)[1])
  if (dim(tf)[1]>1){
    mod <- lm(tf$latitude~tf$doy)
    plot(tf$latitude~tf$doy)
    low <- coefficients(mod)
  } else {
    low <- c(-9999,0)
  }
  
  
  tf <- y[which(between(y[[var]],(q3-thr),(q3+thr)  )),]
  
  
  print(dim(tf)[1])
  if (dim(tf)[1]>1){
    mod <- lm(tf$latitude~tf$doy)
    plot(tf$latitude~tf$doy)
    high <- coefficients(mod)
  } else {
    high <- c(-9999,0)
  }
  
  coef <- rbind(low,high)
  return(as.data.frame(coef))
}

# subset for analysis
subMat <- function(x){
  x <- as.data.frame(x)
  if (all(is.na(x$gall_id))){
    x <- x[grepl('Flower Budding',x$phenophase),] 
  } else {
    x$phenostage <- paste0(x$phenophase, x$lifestage)
    x <- x[!x$phenophase=="senescent",]
    x <- x[!x$phenophase=="",]
    x <- x[!x$phenophase=="developing",]
    x <- x[!x$phenophase=="dormant",]
    x <- x[!x$phenophase=="oviscar",]
  }
  return(x)
}
# subset for analysis
subRear <- function(x){
  x <- as.data.frame(x)
  x <- x[x$viability=="viable"&!is.na(x$viability),]
  return(x)
}

#
doyLatSeasEq <- function(x,y){ 
  if (!all(x$generation=="NA")) { 
    if (any(grepl("agamic",x$generation))){
      sub <- x[which(x$generation=="agamic"),]
      if (min(sub$doy)>171){
        coef <- parcalc(sub,y,"seasind")
      } else {
        coef <- parcalc(sub,y,"acchours")  
      }
      agamlowslope <- coef[1,2]
      agamlowyint <- coef[1,1]
      agamhighslope <- coef[2,2]
      agamhighyint <- coef[2,1]
    } else {
      agamlowslope <- 0
      agamlowyint <- -9999
      agamhighslope <- 0
      agamhighyint <- -9999
    }
    
    
    if (any(grepl("sexgen",x$generation))){
      sub <- x[which(x$generation=="sexgen"),]
      if (min(sub$doy)>171){
        coef <- parcalc(sub,y,"seasind")
      } else {
        coef <- parcalc(sub,y,"acchours")  
      }
      sglowslope <- coef[1,2]
      sglowyint <- coef[1,1]
      sghighslope <- coef[2,2]
      sghighyint <- coef[2,1]
    } else {
      sglowslope <- 0
      sglowyint <- -9999
      sghighslope <- 0
      sghighyint <- -9999
    }
    param <- as.data.frame(t(c(agamlowslope,agamlowyint,agamhighslope,agamhighyint,sglowslope,sglowyint,sghighslope,sghighyint)))
    colnames(param) <- c("agamlowslope","agamlowyint","agamhighslope","agamhighyint","sglowslope","sglowyint","sghighslope","sghighyint")
    
  } else {
    if (min(x$doy)>171){
      coef <- parcalc(x,y,"seasind")
    } else {
      coef <- parcalc(x,y,"acchours")
    }
    lowslope <- coef[1,2]
    lowyint <- coef[1,1]
    highslope <- coef[2,2]
    highyint <- coef[2,1]
    
    param <- as.data.frame(t(c(lowslope,lowyint,highslope,highyint)))
    colnames(param) <- c("lowslope","lowyint","highslope","highyint")
    
  }
  return(param)
}
#
doyLatAGDD50Eq <- function(x,y){ 
  x <- as.data.frame(x)
  if (all(is.na(x$gall_id))){
    x <- x[grepl('Flower Budding',x$phenophase),] 
  } else {
    x$phenostage <- paste0(x$phenophase, x$lifestage)
    x <- x[!x$phenophase=="senescent",]
    x <- x[!x$phenostage=="",]
    x <- x[!x$phenophase=="developing",]  
    x <- x[!x$phenophase=="dormant",] 
    x <- x[!x$phenophase=="oviscar",]
  }
  
  z <- 2
  if (!all(x$generation=="NA")) { 
    if (any(grepl("agamic",x$generation))){
      sub <- x[which(x$generation=="agamic"),]
      if (min(x$doy)>171){
        coef <- parcalc(sub,y,"percent50")
      } else {
        coef <- parcalc(sub,y,"AGDD50")  
      }
      agamlowslope <- coef[1,2]
      agamlowyint <- coef[1,1]
      agamhighslope <- coef[2,2]
      agamhighyint <- coef[2,1]
    } else {
      agamlowslope <- 0
      agamlowyint <- -9999
      agamhighslope <- 0
      agamhighyint <- -9999
    }
    
    
    if (any(grepl("sexgen",x$generation))){
      sub <- x[which(x$generation=="sexgen"),]
      if (min(x$doy)>171){
        coef <- parcalc(sub,y,"percent50")
      } else {
        coef <- parcalc(sub,y,"AGDD50")  
      }
      sglowslope <- coef[1,2]
      sglowyint <- coef[1,1]
      sghighslope <- coef[2,2]
      sghighyint <- coef[2,1]
    } else {
      sglowslope <- 0
      sglowyint <- -9999
      sghighslope <- 0
      sghighyint <- -9999
    }
    param <- as.data.frame(t(c(agamlowslope,agamlowyint,agamhighslope,agamhighyint,sglowslope,sglowyint,sghighslope,sghighyint)))
    colnames(param) <- c("agamlowslope","agamlowyint","agamhighslope","agamhighyint","sglowslope","sglowyint","sghighslope","sghighyint")
    
  } else {
    if (min(x$doy>171)){
      coef <- parcalc(x,y,"percent50")
    } else {
      coef <- parcalc(x,y,"AGDD50")
    }
    lowslope <- coef[1,2]
    lowyint <- coef[1,1]
    highslope <- coef[2,2]
    highyint <- coef[2,1]
    
    param <- as.data.frame(t(c(lowslope,lowyint,highslope,highyint)))
    colnames(param) <- c("lowslope","lowyint","highslope","highyint")
    
  }
  return(param)
}
#
doyLatAGDD32Eq <- function(x,y){ 
  x <- as.data.frame(x)
  if (all(is.na(x$gall_id))){
    x <- x[grepl('Flower Budding',x$phenophase),] 
  } else {
    x$phenostage <- paste0(x$phenophase, x$lifestage)
    x <- x[!x$phenophase=="senescent",]
    x <- x[!x$phenostage=="",]
    x <- x[!x$phenophase=="developing",]  
    x <- x[!x$phenophase=="dormant",] 
    x <- x[!x$phenophase=="oviscar",]
  }
  
  z <- 2
  if (!all(x$generation=="NA")) { 
    if (any(grepl("agamic",x$generation))){
      sub <- x[which(x$generation=="agamic"),]
      if (min(x$doy)>171){
        coef <- parcalc(sub,y,"percent32")
      } else {
        coef <- parcalc(sub,y,"AGDD32")  
      }
      agamlowslope <- coef[1,2]
      agamlowyint <- coef[1,1]
      agamhighslope <- coef[2,2]
      agamhighyint <- coef[2,1]
    } else {
      agamlowslope <- 0
      agamlowyint <- -9999
      agamhighslope <- 0
      agamhighyint <- -9999
    }
    
    
    if (any(grepl("sexgen",x$generation))){
      sub <- x[which(x$generation=="sexgen"),]
      if (min(x$doy)>171){
        coef <- parcalc(sub,y,"percent32")
      } else {
        coef <- parcalc(sub,y,"AGDD32")  
      }
      sglowslope <- coef[1,2]
      sglowyint <- coef[1,1]
      sghighslope <- coef[2,2]
      sghighyint <- coef[2,1]
    } else {
      sglowslope <- 0
      sglowyint <- -9999
      sghighslope <- 0
      sghighyint <- -9999
    }
    param <- as.data.frame(t(c(agamlowslope,agamlowyint,agamhighslope,agamhighyint,sglowslope,sglowyint,sghighslope,sghighyint)))
    colnames(param) <- c("agamlowslope","agamlowyint","agamhighslope","agamhighyint","sglowslope","sglowyint","sghighslope","sghighyint")
    
  } else {
    if (min(x$doy)>171){
      coef <- parcalc(x,y,"percent32")
    } else {
      coef <- parcalc(x,y,"AGDD32")
    }
    lowslope <- coef[1,2]
    lowyint <- coef[1,1]
    highslope <- coef[2,2]
    highyint <- coef[2,1]
    
    param <- as.data.frame(t(c(lowslope,lowyint,highslope,highyint)))
    colnames(param) <- c("lowslope","lowyint","highslope","highyint")
    
  }
  return(param)
}


# creates a new dataframe containing any maturing, adult, perimature observations outside the two lines calculated above
doyLatAnom <- function(x, y) {
  x <- as.data.frame(x)
  if (all(is.na(x$gall_id))){
    x <- x[grepl('Flower Budding',x$phenophase),] 
  } else {
    if (!isTRUE(all(is.na(x$lifestage)))){
      x$phenostage <- paste0(x$phenophase, x$lifestage)
    }
    x <- x[!x$phenophase=="senescent",]
    x <- x[!x$phenostage=="",]
    x <- x[!x$phenophase=="developing",]  
    x <- x[!x$phenophase=="dormant",] 
    x <- x[!x$phenophase=="oviscar",]
  }
  
  if (!isTRUE(all(is.na(x$generation)))) { 
    agam <- x[x$generation=="agamic",]
    if (isTRUE(y$agamlowslope[1]>0)){
      agamlow <- agam[(agam$latitude>y$agamlowslope[1]*agam$doy+y$agamlowyint[1]),]
    } else {
      agamlow <- agam[(agam$latitude<y$agamlowslope[1]*agam$doy+y$agamlowyint[1]),]
    }
    
    if (isTRUE(y$agamhighslope[1]>0)) {
      agamhigh <- agam[(agam$latitude<y$agamhighslope[1]*agam$doy+y$agamhighyint[1]),]
    } else {
      agamhigh <- agam[(agam$latitude>y$agamhighslope[1]*agam$doy+y$agamhighyint[1]),]
    }
    
    sg <- x[x$generation=="sexgen",]
    if (isTRUE(y$sglowslope[1]>0)) {
      sglow <- sg[(sg$latitude>y$sglowslope[1]*sg$doy+y$sglowyint[1]),]
    } else {
      sglow <- sg[(sg$latitude<y$sglowslope[1]*sg$doy+y$sglowyint[1]),]
    }
    
    if (isTRUE(y$sglowslope[1]>0)) {
      sghigh <- sg[(sg$latitude<y$sghighslope[1]*sg$doy+y$sghighyint[1]),]
    } else {
      sghigh <- sg[(sg$latitude>y$sghighslope[1]*sg$doy+y$sghighyint[1]),]
    }
    
    anom <- rbind(agamlow, agamhigh, sglow, sghigh)
    
  } else {
    
    if (isTRUE(y$lowslope[1]>0)) {
      low <- x[(x$latitude>y$lowslope[1]*x$doy+y$lowyint[1]),]
    } else {
      low <- x[(x$latitude<y$lowslope[1]*x$doy+y$lowyint[1]),]
    }
    
    if (isTRUE(y$highslope[1]>0)) {
      high <- x[(x$latitude<y$highslope[1]*x$doy+y$highyint[1]),]
    } else {
      high <- x[(x$latitude>y$highslope[1]*x$doy+y$highyint[1]),]
    }
    
    
    anom <- rbind(low, high)
    
  }
  if (dim(anom)[1]>50){
    warning("There are a lot of anomalous data points--check to make sure something didn't go wrong before browsing to them!")
  } 
  return(anom)
}

# creates a doy x latitude plot of all observations with the 2 sd lines calculated above
doyLatPlot <- function(x, y) {
  
  x <- as.data.frame(x)
  x$phenostage <- paste0(x$phenophase, x$lifestage)
  x <- x[!x$phenophase=="senescent",]
  # x <- x[grepl('Flower Budding',x$phenophase),]
  
  shapes <- c(0,1,17,2,18,8)
  names(shapes) <- c('dormant','developing','maturing','perimature','Adult','oviscar')
  
  if (!all(x$generation=="NA")) { 
    p = ggplot(data = x, aes(x = doy, y = latitude, color=generation, shape=phenophase,size=22)) +
      geom_point()+
      xlim(0,365)+
      scale_shape_manual(values=shapes)+ 
      geom_abline(intercept = y$agamlowyint[1], slope=y$agamlowslope[1], color="#E41A1C")+
      geom_abline(intercept = y$agamhighyint[1], slope=y$agamhighslope[1], color="#E41A1C")+
      geom_abline(intercept = y$sglowyint[1], slope=y$sglowslope[1], color="#008080")+
      geom_abline(intercept = y$sghighyint[1], slope=y$sghighslope[1], color="#008080")
    
  } else {
    p = ggplot(data = x, aes(x = doy %% 365, y = latitude, color=phenophase, shape=phenophase,size=22)) + 
      geom_point()+
      xlim(0,365)+
      scale_shape_manual(values=shapes)+ 
      geom_abline(intercept = y$lowyint[1], slope=y$lowslope[1], color="#E41A1C")+
      geom_abline(intercept = y$highyint[1], slope=y$highslope[1], color="#E41A1C")
  }
  
  return(p)
}


# input a single observation ID (not URL or species code) to delete it from observations table and blacklist the id in baddata
markBad <- function(code) {
  # is the obs code already in the baddata table?
  check <- dbGetQuery(gallphen, str_interp("SELECT 1 FROM baddata WHERE obs_id = '${code}'"))
  
  #if not, add it
  if (dim(check)[1]==0){
    codedf <- as.data.frame(code)
    colnames(codedf) <- "obs_id"
    dbAppendTable(gallphen, "baddata", codedf)
  }
  
  #do any observations have this obs ID in their URL?
  badurl <- paste0("www.inaturalist.org/observations/",code)
  check2 <- dbGetQuery(gallphen, str_interp("SELECT * FROM observations 
                                            WHERE pageURL LIKE '%${badurl}%'"))
  #if so, delete them all
  if (!dim(check2)[1]==0){
    count <- dbExecute(gallphen, str_interp("DELETE FROM observations 
          WHERE pageURL LIKE '%${badurl}%'"))
    return(paste("Number of observations deleted:", count))
  } else {
    return(paste("Number of observations deleted: 0"))
  }
}

# input an inat species code to set the date updated for that species to the current date
setUpdate <- function(code) {
  date <- Sys.Date()
  count <- dbExecute(gallphen, str_interp("UPDATE specieshistory SET update_date = '${date}' WHERE species_id IN (SELECT species_id FROM species WHERE inatcode = '${code}')"))
  return(paste("Number of species update dates set to current date:", count))
}