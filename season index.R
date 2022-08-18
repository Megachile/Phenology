library(solrad)
library(units)
library(stats)
library(pracma)
comb$daylength <- 2*acos(cos(set_units(90.833, "radians"))/(cos(set_units(comb$latitude, "radians"))*cos(set_units(Declination(comb$doy),"radians"))) - tan )/15

daylength <- 2*ha/15

thr <- 10.5
lat <- 45



eq = function(x,lat=45) {(2*(24/(2*pi))*acos(-tan((lat*pi/180))*tan((pi*Declination(x)/180))))-9}

# 
# x <- seq(0,250)
# y <- eq(x,lat,thr)
# x <- data

eas1 <- seasonIndex(eas)
data1 <- seasonIndex(data)
x <- data
y <- eas1

x <- data
y <- eas1



x <- data1
y <- doyLatPercentEq(data1,eas1)
y <- doyLatSeasEq(data1,eas1)

p = ggplot(data = x, aes(x = doy, y = latitude, color=phenophase, shape=phenophase,size=22)) + 
  geom_point()+
  geom_abline(intercept = y$lowyint[1], slope=y$lowslope[1], color="#E41A1C")+
  geom_abline(intercept = y$highyint[1], slope=y$highslope[1], color="#E41A1C")
p


doyLatPlot(data1, y)

plot(data1$percent50~data1$seasind)

x <- 173

eq = function(x,lat=56) {
  adj <- (x - (0.5*(lat/90)*(183-x)))
  if (between(adj,0,365)[1]){
    dec <- adj
  } else {
    dec <- 0
  }
  eq <- (2*(24/(2*pi))*acos(-tan((lat*pi/180))*tan((pi*Declination(dec)/180)))) - (0.1*lat+5) 
  return(eq)}

i=2000
x <- eas
acchours <- function(x){
  for (i in 1:dim(x)[1]){
    doyrange <- NULL
    doyrange <- as.data.frame(seq(1,x$doy[i]))
    names(doyrange)[names(doyrange)=="seq(1, x$doy[i])"] <- "doy"
    for (j in 1:dim(doyrange)[1]){
    doyrange$eq[j] <- pos_part(eq(j,x$latitude[i])) *(90-x$latitude[i]) / eq(171,x$latitude[i]) * (-1/200*x$latitude[i]+647/600)
    }
    x$acchours[i] <- trapz(doyrange$doy,doyrange$eq)
  }
  return(x)
}


eq = function(x,lat=49) { ((2*(24/(2*pi))*acos(-tan((lat*pi/180))*tan((pi*Declination(x-(0.5*(lat/90)*(183-x))-(1.8*lat-50) )/180))))-(0.1*lat+5)) }

ggplot(data.frame(x=c(0, 365)), aes(x=x)) + 
  stat_function(fun=eq) +
  geom_vline(xintercept = 171)

eas <- eas[grepl('2021',eas$date),]

eas <- seasonIndex(eas)
eas <- acchours(eas)


plot(eas$AGDD32~eas$acchours)
plot(eas$AGDD50~eas$acchours)
plot(eas$percent32~eas$seasind)
plot(eas$percent50~eas$seasind)

data <- seasonIndex(data)
data <- acchours(data)
param <- doyLatSeasEq(data,eas)
param <- doyLatAGDD32Eq(data,eas)
param <- doyLatAGDD50Eq(data,eas)
doyLatPlot(data,param)
