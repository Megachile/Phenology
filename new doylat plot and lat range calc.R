# input <- dbGetQuery(gallphen, str_interp("SELECT observations.*, host.species AS host, gall.generation FROM observations
#                              LEFT JOIN species AS host ON observations.host_id = host.species_id
#                              INNER JOIN species AS gall ON observations.gall_id = gall.species_id
#                              WHERE gall_id in (SELECT species_id FROM species
#                              WHERE inatcode = '1400820') "))
#                              
input <- dbGetQuery(gallphen, "SELECT observations.*, host.species AS host, gall.generation, gall.species FROM observations 
                             LEFT JOIN species AS host ON observations.host_id = host.species_id
                             INNER JOIN species AS gall ON observations.gall_id = gall.species_id
                             WHERE gall_id IN (SELECT species_id FROM species
                             WHERE (genus = 'Neuroterus') AND species LIKE '%sbatatus%') AND country NOT IN ('Mexico','Costa Rica')")

# AND species LIKE '%spalustr%' AND generation = 'sexgen'
#AND (species LIKE '%confluenta%' OR species LIKE '%spongif%')
#AND species LIKE '%mamma%' 
#AND (species LIKE '%floccos%' OR species LIKE '%verruc%')
# input <- input[!(input$gall_id=="1084"),]
# input <- input[!(input$state=="TX"),]
data <- input
# data <- data[data$gall_id == '803',]
# data <- data[data$latitude>31,]
# data <- filter(data, viability != "")
data <- data[(data$generation=="agamic"),]
# data <- data[(data$generation=="sexgen"),]
# data <- data[data$doy>200,]
data <- data[!(data$phenophase=="developing"),]
data <- data[!(data$phenophase=="dormant"),]
data <- data[!(data$phenophase=="oviscar"),]
# data <- data[!(data$state=="CA"),]

data <- data[!is.na(data$obs_id),]
# data <- data[!(data$phenophase=="perimature"),]
# data <- data[!(data$phenophase=="maturing"),]
data <- seasonIndex(data)
data <- acchours(data)
doy <- sort(data$doy)
#sort by doy
x <- data[sort(data$doy),]
# Compute the differences between successive elements
diffs <- diff(doy)
# Find the maximum difference
max_diff <- max(diffs)

if (max_diff>89|min(data$doy)>171){

# Find the index of the element that precedes the largest gap
split_index <- which(diffs == max_diff)

# Divide the dataset into two subsets based on the split index
spring <- data[data$doy <= doy[split_index], ]
fall <- data[data$doy > doy[split_index], ]

var <- "seasind"
thr <- 0.02

left <- mean(unique(spring[spring$doy==max(spring$doy),"seasind"]))
right <- mean(unique(fall[fall$doy==min(fall$doy),"seasind"]))

} else {
  var <- "acchours"
  left <-  min(data$acchours)
  right <-  max(data$acchours)

  # left <-  250
  # right <-  500

  # left <- mean(unique(data[data$doy==min(data$acchours),"acchours"]))
  # right <- mean(unique(data[data$doy==max(data$acchours),"acchours"]))
  thr <- ((left+right)/2)*0.08
}



y <- eas
y <- distinct(y)

tf <- y[which(between(y[[var]],(left-thr),(left+thr)  )),]
# tf$dist <-  abs(tf[[var]]-left)
# quantile(tf$dist)[4]
# tf <- tf[!(tf$dist>quantile(tf$dist)[4]),]
# print(dim(tf)[1])

tf <- unique(tf)
# Group the data by y value
tf_grouped <- tf %>% group_by(latitude)

# Remove all but the point with the lowest x value for each group
tf <- tf_grouped %>% filter(doy == max(doy))

if (dim(tf)[1]>1){
  
mod <- lm(tf$latitude~tf$doy)
  plot(tf$latitude~tf$doy)
  low <- coefficients(mod)
} else {
  low <- c(-9999,0)
}


tf <- y[which(between(y[[var]],(right-thr),(right+thr)  )),]
tf <- unique(tf)
# Group the data by latitude
tf_grouped <- tf %>% group_by(latitude)
# Remove all but the point with the lowest doy value for each group
tf <- tf_grouped %>% filter(doy == min(doy))

print(dim(tf)[1])
if (dim(tf)[1]>1){
  mod <- lm(tf$latitude~tf$doy)
  plot(tf$latitude~tf$doy)
  high <- coefficients(mod)
} else {
  high <- c(-9999,0)
}

coef <- rbind(low,high)

lowslope <- coef[1,2]
lowyint <- coef[1,1]
highslope <- coef[2,2]
highyint <- coef[2,1]

param <- as.data.frame(t(c(lowslope,lowyint,highslope,highyint)))
colnames(param) <- c("lowslope","lowyint","highslope","highyint")
x <- input
y <- param
x <- as.data.frame(x)
# x <- x[grepl('Flower Budding',x$phenophase),]
ymin <- min(input$latitude)
ymax <- max(input$latitude)
x[x$phenophase == "","phenophase"] <- "Adult"
shapes <- c(0,1,17,2,18,8)
names(shapes) <- c('dormant','developing','maturing','perimature','Adult','oviscar')

# Assign colors to different groups of points
x$color <- ifelse(x$generation == "agamic", "agamic",
                  ifelse(x$generation =="sexgen","sexgen","NA"))

# Assign alpha to different groups of points
x$lifestage[x$lifestage == ""] <- NA
for (i in 1:dim(x)[1]){
x$alpha[i] <- ifelse(isTRUE(!is.na(x$lifestage[i]) | x$viability[i] == "viable"), 1, 0.2)
}

p = ggplot(data = x, aes(x = doy, y = latitude, color = color, shape=phenophase,size=22, alpha = alpha)) +
  geom_point()+
  xlim(0,365)+
  ylim(23,55)+
  # ylim(ymin,ymax)+
  scale_color_manual(values = c("NA"="black","sexgen" = "blue", "agamic"="red"))+
  scale_shape_manual(values=shapes)+
  geom_abline(intercept = y$lowyint[1], slope=y$lowslope[1], color="#E41A1C")+
  geom_abline(intercept = y$highyint[1], slope=y$highslope[1], color="#E41A1C")
p


testlat <- 41.3
as.Date(((testlat - lowyint)/lowslope),"2023-01-01")
# testlat <- 44
as.Date(((testlat - highyint)/highslope),"2023-01-01")

