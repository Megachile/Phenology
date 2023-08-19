species <- npn_species()
solidago <- species[species$genus=="Solidago",]

solidago <- npn_download_individual_phenometrics(  request_source = 'Gallformers', 
                                                   years = c(2008:2019), 
                                                   genus_ids = c(1003),
                                                  )
unique(solidago$phenophase_description)
solcodes <- npn_phenophases_by_species(c(205,299,186,747,1643,1028,1770),2020-03-31)
p = ggplot(solidago, aes(x = first_yes_doy, y = latitude, phenophase_description)) +
    geom_point(data = ~filter(.x, phenophase_description == "Flowers or flower buds"), colour = "green") +
    geom_point(data = ~filter(.x, phenophase_description == "Open flowers"), colour = "yellow") +                    
    geom_point(data = ~filter(.x, phenophase_description == "Fruits"), colour = "brown") +                  
    geom_point(data = ~filter(.x, phenophase_description == "Ripe fruits"), colour = "gray") 
    p

boxplot(solidago$first_yes_doy~solidago$phenophase_description, horizontal=TRUE)




### Get annotation codes
a <- fromJSON("https://api.inaturalist.org/v1/controlled_terms")
a <- flatten(a$results)
l <- lapply(seq_along(a[, "values"]), function(i) {
  cbind(idann = a$id[i], labelann = a$label[i], a[i, "values"][[1]][, c("id", "label")])
})
ann <- do.call("rbind", l)
ann

keep <-
  c("id", "observed_on", "taxon.name", "location", "uri", "ofvs","annotations") # values to keep

### Request url by Taxon ID
url <-
  paste0(
    "https://api.inaturalist.org/v1/observations?quality_grade=research&identifications=any&page=1&per_page=200&place_id=6712&order=desc&order_by=created_at&d1=2016-01-01&term_id=12&term_value_id=13%2C15&taxon_id=",
    "67808%2C83073%2C79148%2C128551"
  )

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
}

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
  id + uri + observed_on + location + taxon.name + name + value ~ labelann,
  value.var = "label",
  fun = function(i) {
    paste(i, collapse = "; ")
  }
)
names(obs) <- gsub(" ", "_", names(obs)) # remove spaces from column names
setDT(obs) # turn df to data.table to use dcast
obs <- dcast(
  obs,
  id + uri + observed_on + location + taxon.name + Plant_Phenology  ~ name,
  value.var = "value",
  fun = function(i) {
    paste(i, collapse = "; ")
  }
)
names(obs) <- gsub(" ", "_", names(obs)) # remove spaces from column names

## for galls with no generation tags
obs <- obs[,c("id", "observed_on", "taxon.name","location","uri","Plant_Phenology")]

## process variables
obs <- obs %>% separate(location, c("latitude","longitude"), ",")
obs$doy <- yday(obs$observed_on)
obs$latitude <- as.numeric(obs$latitude)

proces <- NULL
proces <- PrepHostAppend(obs)

proces$host_id <- as.numeric(proces$host_id)
str(proces)



solagdd <- solinat[solinat$AGDD32=="-9999",]

solagdd$percent32 <- NULL

solinat[solinat$id=="7815215",9]

solinat$AGDD32 <- NULL

solagdd <- lookUpAGDD(solagdd, "currentyearend")

solinat <- lookUpAGDD(solinat,"currentyearend")
solinat$yr1AGDD32 <- solinat$AGDD32
solinat$AGDD32 <- solinat$currentyear32
solinat$yr1AGDD32 <- solinat$AGDD32
solinat$currentyearend <- as.character(paste0(year(solinat$observed_on), "-12-31"))


solcomb <- join(solinat, solagdd, by=c("id","taxon.name","latitude","longitude","uri","Plant_Phenology","doy"), type = "left")

solcomb <- for (i in 1:dim(solcomb)[1]){
  if (is.na(solcomb$currentyear32[i])){
    solcomb$currentyear32[i] <- solcomb$AGDD32[i]
  } else {
    solcomb$currentyear32[i] <- solcomb$currentyear32[i]
  }
  return(solcomb)
}


solinat <- lookUpAGDD50(solinat)
solinat$latitude <- as.numeric(solinat$latitude)


solinat$obsdate <-  NULL
names(solinat)[names(solinat)=="AGDD32"] <- "currentyear32"
names(solinat)[names(solinat)=="AGDD50"] <- "currentyear50"

solinat$percent32 <- solinat$yr1AGDD32/solinat$currentyear32
solinat <- separate(solinat, col=taxon.name, into=c('genus','species','subsp'), sep=' ')


p = ggplot(data = soljoin, aes(x = percent50, y = latitude, color=Plant_Phenology, shape =Plant_Phenology,size=22)) + 
  geom_point()
  xlim(0.01,1.0)
p

solidago$phenophase_description <- gsub("Flowers or flower buds", "Flowering; Flower Budding", solidago$phenophase_description)
solidago$phenophase_description <- gsub("Open flowers", "Flowering", solidago$phenophase_description)
solidago$phenophase_description <- gsub("Fruits", "Fruiting", solidago$phenophase_description)

names(solidago)[names(solidago)=="phenophase_description"] <- "Plant_Phenology"

solidago$observed_on <- as.Date(paste(solidago$first_yes_year, formatC(solidago$first_yes_month, width=2, flag="0"),formatC(solidago$first_yes_day, width=2, flag="0"),sep="-"))

soltrans <- solidago[,c(2,3,7,8,15,19,28)]
soltrans <- soltrans[which(soltrans$Plant_Phenology==c("Flowering; Flower Budding","Flowering","Fruiting")),]

soltrans <- soltrans[which(year(soltrans$observed_on)>2015),]

soltrans <- lookUpAGDD(soltrans)

soltrans$observed_on <- soltrans$obsdate
soltrans <- lookUpAGDD50(soltrans)
soltrans$yr1AGDD50 <- soltrans$AGDD50
soltrans$currentyear50 <- soltrans$yr1AGDD50
soltrans$percent50 <- soltrans$yr1AGDD50/soltrans$currentyear50



soltrans$id <- NA
soltrans$subsp <- NA
soltrans$uri <- NA

# soltrans <- soltrans[,1:11]
names(solinat)[names(solinat)=="currentyear32"] <- "yearend32"
names(solinat)[names(solinat)=="yr1AGDD32"] <- "AGDD32"
solinat <- lookUpAGDD(solinat)

setdiff(colnames(soltrans), colnames(solinat))
setdiff(colnames(solinat), colnames(soltrans))
solinat$observed_on <- as.Date(solinat$observed_on)

soljoin <- rbind(solinat, soltrans)

boxplot(soljoin$doy~soljoin$species, horizontal=TRUE)

write.csv(soljoin, paste0(wd,"/solidagofloweringdatainatnpn.csv"), row.names = FALSE)


check <- rugosa[which(rugosa$percent32<.37),]
check <- check[order(-check$percent50),]

for (i in 1:20){
  browseURL(check$uri[i])
}

solinat <- solinat[!solinat$id=="47682050",]
solinat <- solinat[!solinat$id=="44396940",]
solinat <- solinat[!solinat$id=="37505790",]
solinat <- solinat[!solinat$id=="27206505",]
solinat <- solinat[!solinat$id=="27044147",]
solinat <- solinat[!solinat$id=="21136349",]
