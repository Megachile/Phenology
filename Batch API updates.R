# Load necessary packages
library(httr)
library(beepr) # this beeps when the run is done
library(jsonlite)
library(dplyr)
library(data.table)
library(stringr)
library(tidyr)

# testurl <- "https://api.inaturalist.org/v1/observations?quality_grade=any&identifications=any&page=1&place_id=6712%2C1&per_page=200&order=desc&order_by=created_at&taxon_id=1374476"
# testurl <- "https://api.inaturalist.org/v1/observations/173533172"
# response <- fromJSON(testurl)

### Get annotation codes
a <- fromJSON("https://api.inaturalist.org/v1/controlled_terms/")
a <- flatten(a$results)
l <- lapply(seq_along(a[, "values"]), function(i) {
  cbind(idann = a$id[i], labelann = a$label[i], a[i, "values"][[1]][, c("id", "label")])
})
ann <- do.call("rbind", l)
ann

#not clear if this stored API token will expire or not? If it does you'll need to use one of the auth flows which I'm having trouble getting to work without my password right now
token <- "nxZOyguyMyTGYC19gGbfnGAKbgP2CgWgCeqQ12U_fno"



#all necessary functions:

### function to add annotations
add_annotation <- function(site, observation_id, controlled_attribute_id, controlled_value_id, token) {
  url <- paste0(site, "/v1/annotations")
  post_data <- list(
    annotation = list(
      resource_type = "Observation",
      resource_id = observation_id,
      controlled_attribute_id = controlled_attribute_id,
      controlled_value_id = controlled_value_id
    )
  )
  json_data <- toJSON(post_data, auto_unbox = TRUE)
  headers <- add_headers(c("Authorization" = paste("Bearer", token),
                           "Content-Type" = "application/json"))
  response <- POST(url, body = json_data, headers, encode = "json")
  # content(response, "parsed", type = "application/json")
}

### function to add observation fields
add_observation_field <- function(site, observation_id, observation_field_id, value, token) {
  url <- paste0(site, "/v1/observation_field_values")
  post_data <- list(
    observation_field_value = list(
      observation_id = observation_id,
      observation_field_id = observation_field_id,
      value = value
    )
  )
  json_data <- toJSON(post_data, auto_unbox = TRUE)
  headers <- add_headers(c("Authorization" = paste("Bearer", token),
                           "Content-Type" = "application/json"))
  # Use a try-catch block to handle any errors
  try({
    # Send the POST request
    response <- POST(url, body = json_data, headers)
    
    # Check the response status
    if(response$status_code >= 400){
      print(paste("Error:", response$status_code, content(response)$error))
    }
  }, silent = TRUE)  # content(response, "parsed", type = "application/json")
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

get_observation_pages <- function(url) {
  keep <- c("id", "observed_on","taxon.name", "location", "uri","ofvs","annotations","place_ids")
  nobs <- fetch_data(url)

  # Check for valid nobs data
  if (!is.null(nobs) && !is.null(nobs$total_results) && nobs$total_results > 0 && !is.null(nobs$results) && length(nobs$results) > 0) {
    npages <- ceiling(nobs$total_results / 200)
    
    xout <- flatten(nobs$results)
    
    if (all(keep %in% names(xout))) {
      xout <- xout[, keep]
    } else {
      warning("Some columns specified in 'keep' are missing in the data.")
    }
  } else {
    warning("iNat has no matching records for this species.")
    xout <- NULL # Default value
    npages <- 0 # Ensure that the following loop doesn't run
  }
  
  if (npages > 1) {
    for(i in 2:npages) {
      page <- paste0("&page=", i)
      
      x <- NULL
      
      while(is.null(x)){
        Sys.sleep(1)
        x <- fetch_data(gsub("&page=1", page, url))
      }
      
      if(!is.null(x) && !is.null(x$results)) {
        x <- flatten(x$results)
        x1 <- x[, keep]
        xout <- rbind(xout, x1)
      }
    }
  }
  return(xout)
}

extract_annotations <- function(x, ann) {
  keep <- c("id", "observed_on","taxon.name", "location", "uri","ofvs","annotations","place_ids")
  vals <- lapply(seq_along(x$annotations), function(i) {
    j <- x$annotations[[i]]
    n <- c("controlled_attribute_id", "controlled_value_id")
    if (all(n %in% names(j))) {
      ans <- j[, n]
    } else{
      ans <- data.frame(x = NA, y = NA)
      names(ans) <- n
    }
    cbind(x[i, keep][rep(1, nrow(ans)),], ans)
  })
  vals <- do.call("rbind", vals)
  return(vals)
}


extract_observation_fields <- function(vals, ann) {
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
    )

    
    of <- lapply(seq_along(vals$ofvs), function(i) {
      f <- vals$ofvs[[i]]
      m <- c("name", "value")
      if (all(m %in% names(f))) {
        ans <- f[, m]
      } else{
        ans <- data.frame(x = NA, y = NA)
        names(ans) <- m
      }
      cbind(vals[i, keep][rep(1, nrow(ans)),], ans)
    })
    
    of <- do.call("rbind", of)
    of$country <- sapply(of$place_ids,"[[",1)
    of$place_ids <- NULL
    of$country <- gsub("6712","Canada",of$country)
    of$country <- gsub("1","USA",of$country)

    obs <- merge(of, ann, by.x = c("controlled_attribute_id", "controlled_value_id"), by.y = c("idann", "id"), all.x = TRUE)

    obs <- obs[order(obs$id), ]

    return(obs)
  }

cast_and_concatenate <- function(obs) {
  setDT(obs)
  sum(is.na(obs$id))
  obs <- dcast(obs, id + uri + observed_on + location + country + taxon.name + name + value ~ labelann, value.var = "label", fun = function(i) { paste(i, collapse = "; ")})
  names(obs) <- gsub(" ", "_", names(obs))
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
  obs <- dcast(obs, id + uri + observed_on + location + taxon.name + country + Evidence_of_Presence + Life_Stage + Plant_Phenology ~ name, value.var = "value", fun = function(i) { paste(i, collapse = "; ")})
  names(obs) <- gsub(" ", "_", names(obs))
  names(obs) <- make.names(names(obs), unique = TRUE)
  obs <- select(obs, one_of(c("id","observed_on", "country","taxon.name","location","uri","Plant_Phenology","Evidence_of_Presence","Life_Stage","Gall_generation","Gall_phenophase","Host_Plant_ID","Rearing_viability")))
  obs <- obs %>% separate(location, c("latitude","longitude"), ",")
  obs$doy <- yday(obs$observed_on)
  obs <- Filter(function(x)!all(is.na(x)),obs)
  return(obs)
}

iNatCall_refactored <- function(url) {
  xout = get_observation_pages(url)
  if (is.null(xout)) {
    warning("xout is NULL. Exiting iNatCall_refactored.")
    return(NULL)
  }
  
  vals = extract_annotations(xout, ann)
  obs = extract_observation_fields(vals, ann)
  obs = cast_and_concatenate(obs)
  return(obs)
}

urlMakerRG <- function(code) {
  url <-
    str_interp(
      "https://api.inaturalist.org/v1/observations?quality_grade=research&identifications=any&page=1&place_id=6712%2C1&per_page=200&without_field=Gall%20generation&order=desc&order_by=created_at&taxon_id=${code}"
    )  
  return(url)
}


#test on a single observation
# obsid <- 54901584

# Adding annotation EoP gall
# add_annotation(site, obsid, 22, 29, token)
# 
# # Adding gall generation
# add_observation_field(site, obsid, 5251, "bisexual", token)
# 
# # Adding gall phenophase
# add_observation_field(site, obsid, 15121, "senescent", token)
# 
# # Adding host plant ID
# add_observation_field(site, obsid, 6586, 49005, token)




#add to one taxon at a time (can be genus or species etc). Add the inat taxon code
specid <- 1094748

url <- urlMakerRG(specid)
site <- "https://api.inaturalist.org"
missing <- iNatCall_refactored(url)
beep()
print(missing$taxon.name[1])
cat("Adding these observation fields will take approximately", dim(missing)[1]/3600, "hours")

for(obsid in missing$id){
  # Rate limiter
  Sys.sleep(1)
  
  # Add observation field
  add_observation_field(site, obsid, 5251, "bisexual", token)
}
beep()

# Function to process a specid
process_specid <- function(specid, generation) {
  site <- "https://api.inaturalist.org"
  
  # Create the URL
  url <- urlMakerRG(specid)
  
  # Get the observations
  obs <- iNatCall_refactored(url)
  
  # Check if obs is NULL
  if (is.null(obs)) {
    warning(sprintf("No observations fetched for specid: %s. Skipping processing.", specid))
    return(NULL)  # You can choose to return NULL or some other informative result.
  }
  
  print(obs$taxon.name[1])
  
  # Check for missing 'Gall_generation' observation fields
  missing <- obs[obs$Gall_generation == "",]
  
  # Add observation fields for each missing ID
  for(obsid in missing$id) {
    # Rate limiter
    Sys.sleep(1)
    
    # Add observation field
    add_observation_field(site, obsid, 5251, generation, token)
  }
}


process_specid(1136826, 'bisexual')

# Apply in a batch to many species at once 
# (ensure they're all the same generation and the correct one is selected!)

#agamic -- use "subset cynipini by gen.R" to make these dataframes listing the inatcodes for each generation
is.data.frame(only_agamic)

# Apply the function to each specid of only_agamic
mapply(process_specid, only_agamic$inatcode, 'unisexual')

#sexgen
is.data.frame(only_sexgen)

# Apply the function to each specid of only_sexgen
mapply(process_specid, only_sexgen$inatcode, 'bisexual')




## new code to do phenophase in month batches

# Updated URL Maker Function
urlMakerRG <- function(code, month) {
  url <- str_interp(
    "https://api.inaturalist.org/v1/observations?quality_grade=research&identifications=any&page=1&place_id=6712%2C1&per_page=200&without_field=Gall%20phenophase&order=desc&order_by=created_at&taxon_id=${code}&month=${month}"
  )  
  return(url)
}

# Process Observations for a Specific Month and Specid
process_specid_month <- function(specid, month, phenophase) {
  site <- "https://api.inaturalist.org"
  phenophase_field_id <- 15121 # ID for Gall phenophase field
  
  # Create the URL with month filter
  url <- urlMakerRG(specid, month)
  
  # Get the observations
  obs <- iNatCall_refactored(url)
  
  # Check if obs is NULL
  if (is.null(obs)) {
    warning(sprintf("No observations fetched for specid: %s in month: %s. Skipping processing.", specid, month))
    return(NULL)
  }
  
  print(obs$taxon.name[1])
  
  # Add observation fields for each ID
  for(obsid in obs$id) {
    # Rate limiter
    Sys.sleep(1)
    
    # Add Gall phenophase observation field
    add_observation_field(site, obsid, phenophase_field_id, phenophase, token)
  }
}

# Example usage for a specific species and month
# Replace <specid>, <month>, and <phenophase> with appropriate values
process_specid_month(123900, 4, 'developing')



