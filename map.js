var markers = [];
var transitLayer;
var transitToggle = false;
var bicycleLayer;
var bicycleToggle = false;
var trafficLayer;
var trafficToggle = false;
var map, directionsDisplay, stepDisplay;
var locationName;
var locationDisplay
var savedRoutes = [];
var savedPlaces = [];
var currOpenMarker;

const {shell} = require('electron')
function openSite(url) {
  shell.openExternal(url);
}

Storage.prototype.setObj = function(key, obj) {
  return this.setItem(key, JSON.stringify(obj))
}

Storage.prototype.getObj = function(key) {
  return JSON.parse(this.getItem(key))
}

 //localStorage.setObj(localStorage.length, newPlace);
 
var pos = {
  lat: -38.132249,
  lng: 144.827278
};

function initMap() {
  //localStorage.clear();
  // First time script runs display is null
  // FIX: 
  document.getElementById("markerInfo").style.display = "none";

  if(localStorage.length === 0) {
    localStorage.setObj(0, savedRoutes);
    //localStorage.setObj(1, savePlaces)
  }

  loadSavedRoutes();
  
  transitLayer = new google.maps.TransitLayer();
  trafficLayer = new google.maps.TrafficLayer();
  bicycleLayer = new google.maps.BicyclingLayer();
  markers = [];
  var options = {
    zoom: 8,
    center: pos,
    gestureHandling: 'greedy',
    minZoom: 2
  }
  // Create a map object and specify the DOM element
  // for display.
  map = new google.maps.Map(document.getElementById('map'), options);
  // Create a renderer for directions and bind it to the map.
  directionsDisplay = new google.maps.DirectionsRenderer({
    map: map
  });
  // Instantiate an info window to hold step text.
  stepDisplay = new google.maps.InfoWindow;
  // // Listen to change events from the start and end lists.
  var directionsService = new google.maps.DirectionsService;

  // Adds autocomplete to sart and end search bars
  var inputStart = document.getElementById('start');
  var inputEnd = document.getElementById('end');
  map.controls.push(inputStart);
  map.controls.push(inputEnd);
  var autocompleteStart = new google.maps.places.Autocomplete(inputStart);
  var autocompleteEnd = new google.maps.places.Autocomplete(inputEnd);
  autocompleteStart.bindTo('bounds', map);
  autocompleteEnd.bindTo('bounds', map);

  var onChangeHandler = function() {
    calculateAndDisplayRoute(
      directionsDisplay, directionsService, markers, stepDisplay, map);
  };

  document.getElementById('press').addEventListener('click', onChangeHandler);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      map.setCenter(pos);

      markers.push(new google.maps.Marker({
        map: map,
        position: pos,
        title: 'Current Location!'
      }));

      geocodeLatLng(new google.maps.Geocoder, pos);
    })
  }

  //!--------------------------
  // Code to display search box
  // Create the search box and link it to the UI element.
  var input = document.getElementById('pac-input');
  var searchBox = new google.maps.places.SearchBox(input);
  locationDisplay = new google.maps.InfoWindow;
 
  // Bias the SearchBox results towards current map's viewport.
  map.addListener('bounds_changed', function() {
    searchBox.setBounds(map.getBounds());
  });

  markers = [];
  // Listen for the event fired when the user selects a prediction and retrieve
  // more details for that place.
  searchBox.addListener('places_changed', function() {
    var places = searchBox.getPlaces();

    if (places.length == 0) {
      return;
    }

    clearMarkers();

    // For each place, get the icon, name and location.
    var bounds = new google.maps.LatLngBounds();
    clearMarkers();
    places.forEach(function(place) {
      if (!place.geometry) {
        console.log("Returned place contains no geometry");
        return;
      }

      // Create a marker for each place.
      var lookMarker = new google.maps.Marker({
        map: map,
        title: place.name,
        position: place.geometry.location
      });

      markers.push(lookMarker);

      google.maps.event.addListener(lookMarker, 'click', function() {
        // Open an info window when the marker is clicked on, containing the text
        // of the step.
        var markerSets = '<br> Make <a onclick="addStart()" id="make">START</a> or <a onclick="addDestination()" id="make">DESTINATION</a>';
        locationName = place.formatted_address;
        stepDisplay.setContent('Name: ' + place.name + '<br>Adress: ' + 
          locationName +'<br>Rating: ' + place.rating
          + '<br> Make <a onclick="addStart()" id="make">START</a> or <a onclick="addDestination()" id="make">DESTINATION</a>' );
        //stepDisplay.open(map, lookMarker);
        var ref = place.photos[0].getUrl({
            maxWidth: 800,
            maxHeight: 800
         });

        var request = {
          placeId: place.place_id,
          fields: ['url', 'website']
        };

        var service = new google.maps.places.PlacesService(map);
        

        document.getElementById("markerIcon").src = ref;
        document.getElementById("markerName").innerHTML = place.name + ' ' +place.rating;
        document.getElementById("markerSets").innerHTML = place.formatted_address + ' ' + markerSets;
        // document.getElementById("markerSets").innerHTML += '<br>' + "<a href='#'' id='make' onclick='savePlace(\"" + place + "\")'> Save!</a>";

        service.getDetails(request, callback);

        function callback(placeNew, status) {
          document.getElementById("markerSets").innerHTML += "<br> <a id='make' href='#' onclick='openSite(\"" + placeNew.website + "\")'>Website</a>";
          //document.getElementById("markerSets").innerHTML += '<br>' + "<a href='#' onclick='openSite(\"" + placeNew.url + "\")'>See in Google Maps (For more details)</a>";
        }

        if(currOpenMarker === place.id) {
          toggleMarkerInfo();
          return;
        }
        else if(document.getElementById("markerInfo").style.display === "none"){
          toggleMarkerInfo();
          return;
        }
        currOpenMarker = place.id;
      });

      if (place.geometry.viewport) {
        // Only geocodes have viewport.
        bounds.union(place.geometry.viewport);
      } else {
        bounds.extend(place.geometry.location);
      }
    });
    map.fitBounds(bounds);
    document.getElementById("clearButton").style.display = "inline";
  });
}

function calculateAndDisplayRoute(directionsDisplay, directionsService,
  markerArray, stepDisplay, map) {
  // First, remove any existing markers from the map.
  for (var i = 0; i < markerArray.length; i++) {
    markerArray[i].setMap(null);
  }

  // Retrieve the start and end locations and create a DirectionsRequest using
  // WALKING directions.
  directionsService.route({
    origin: document.getElementById('start').value,
    destination: document.getElementById('end').value,
    travelMode: document.getElementById('mode').value
  }, function(response, status) {
    // Route the directions and pass the response to a function to create
    // markers for each step.
    if (document.getElementById('mode').value === "BICYCLING")
    {
      bicycleLayer.setMap(map);
      bicycleToggle = true;
    }

    if (status === 'OK') {
      directionsDisplay.setDirections(response);
      directionsDisplay.setMap(map);
      showSteps(response, markerArray, stepDisplay, map);
    } else {
      window.alert('Directions request failed due to ' + status);
    }
  });
  document.getElementById("clearButton").style.display = "inline";
}

function showSteps(directionResult, markerArray, stepDisplay, map) {
  // For each step, place a marker, and add the text to the marker's infowindow.
  // Also attach the marker to an array so we can keep track of it and remove it
  // when calculating new routes.
  var myRoute = directionResult.routes[0].legs[0];
  document.getElementById("Estimate").innerHTML = "Estimate: " + myRoute.duration.text + " & " + myRoute.distance.text;
  for (var i = 0; i < myRoute.steps.length; i++) {
    var marker = markerArray[i] = markerArray[i] || new google.maps.Marker;
    marker.setMap(map);
    marker.setPosition(myRoute.steps[i].start_location);
    attachInstructionText(
      stepDisplay, marker, myRoute.steps[i].instructions, map);
  }
}

function attachInstructionText(stepDisplay, marker, text, map) {
  google.maps.event.addListener(marker, 'click', function() {
    // Open an info window when the marker is clicked on, containing the text
    // of the step.
    stepDisplay.setContent(text);
    stepDisplay.open(map, marker);
  });
}

function saveRoute() {
  if(document.querySelector("#name").value === "" || 
    document.querySelector("#end").value === ""||
    document.querySelector("#start").value === "") {
    alert("Not all fields are filled!");
    return;
  }

  var newPlace = {
    name: document.querySelector("#name").value,
    start: document.querySelector("#start").value,
    end: document.querySelector("#end").value,
    mode: document.getElementById('mode').value
  };

  savedRoutes = localStorage.getObj(0);
  savedRoutes.push(newPlace);
  localStorage.setObj(0, savedRoutes);
  loadSavedRoutes();
}

function savePlace(address) {
  //alert( address.name);
  var newPlace = {
    name: address.formatted_address
  };
  savedPlaces = localStorage.getObj(1);
  savedPlaces.push(newPlace);
  localStorage.setObj(1, savedPlaces);
  loadSavedPlaces();
}

function loadSavedPlaces() {
  document.getElementById('savedRoutes').innerHTML = "";
  savedPlaces = localStorage.getObj(1);
  for (var i = 0; i < savedPlaces.length; i++) {
    let element = document.getElementById('savedRoutes');
     element.innerHTML += "<a href='#' onclick='applySearch(\"" + i + "\")'>" + savedPlaces[i].name 
     + '</a>' +"<img id='x' src='https://www.shareicon.net/download/2016/12/29/866470_notcorrect-sign-wrong-x_512x512.png' onclick='removeStuff(\"" + i + "\")'/>" + '<br>';
  }
}

function loadSavedRoutes() {
  document.getElementById('savedRoutes').innerHTML = "";
  savedRoutes = localStorage.getObj(0);
  for (var i = 0; i < savedRoutes.length; i++) {
    let element = document.getElementById('savedRoutes');
     element.innerHTML += "<a href='#' onclick='applyStuff(\"" + i + "\")'>" + savedRoutes[i].name 
     + '</a>' +"<img id='x' src='https://www.shareicon.net/download/2016/12/29/866470_notcorrect-sign-wrong-x_512x512.png' onclick='removeStuff(\"" + i + "\")'/>" + '<br>';
  }
}

function applyStuff(i){
  document.querySelector("#start").value = savedRoutes[i].start;
  document.querySelector("#end").value = savedRoutes[i].end;
  document.querySelector("#mode").value = savedRoutes[i].mode;
  document.getElementById("press").click();
}

function applySearch(i) {
  document.querySelector("#pac-input").value = savedPlaces[i].name;
}

function removeStuff(i) {
  var tempName = savedRoutes[i].name;
  savedRoutes.splice(i, 1);
  localStorage.setObj(0, savedRoutes);
  loadSavedRoutes();
}

// !-----------------------
// Auto-fills the two search bars for start and end

function addStart() {
  document.querySelector("#start").value = locationName;
}

function addDestination() {
   document.querySelector("#end").value = locationName;
}

$(document).ready(function(){
  $( "#x-start" ).click(function() {
    document.querySelector("#start").value = "";
  });
});

$(document).ready(function(){
  $( "#x-end" ).click(function() {
    document.querySelector("#end").value = "";
  });
});

// !-----------------------
// Clears markers upon map searches

function clearMarkers() {
  // Clear out the old markers.
  markers.forEach(function(marker) {
    marker.setMap(null);
  });
  markers = [];

  // Clear past routes
  if (directionsDisplay != null) {
    directionsDisplay.setMap(null);
  }
}

// !-----------------------
// Clears markers on map AND search-bar input

function clearSearch() {
  document.querySelector("#pac-input").value = "";
  markers.forEach(function(marker) {
    marker.setMap(null);
  });
  markers = [];
  if (directionsDisplay != null) {
    directionsDisplay.setMap(null);
  }
  document.getElementById("clearButton").style.display = "none";
  document.getElementById("markerInfo").style.display = "none";
}

// !-----------------------
// Toggle functions for various map features

function toggleTransit() {
  if (transitToggle) {
    transitLayer.setMap(null);
    transitToggle = false;
  } else {
    transitLayer.setMap(map);
    transitToggle = true;
  }
}

function toggleTraffic() {
  if (trafficToggle) {
    trafficLayer.setMap(null);
    trafficToggle = false;
  } else {
    trafficLayer.setMap(map);
    trafficToggle = true;
  }
}

function toggleBicycle() {
  if (bicycleToggle) {
    bicycleLayer.setMap(null);
    bicycleToggle = false;
  } else {
    bicycleLayer.setMap(map);
    bicycleToggle = true;
  }
}

function toggleMarkerInfo() {
  var div = document.getElementById("markerInfo");
  div.style.display = div.style.display == "block" ? "none" : "block";
}

function toggleExtra() {
  var div = document.getElementById("extraOptions");
  var sideBar = document.getElementById("sideBar");
  sideBar.style.height = sideBar.style.height == "13vh" ? "100vh" : "13vh";
  div.style.display = div.style.display == "none" ? "block" : "none";
}

function toggleHideBar() {
  var sideBar = document.getElementById("sideBar");
  sideBar.style.display = sideBar.style.display == "block" ? "none" : "block";
}

// !-----------------------
// Adds listener to map to check window screen size and adjusts it accordingly 

google.maps.event.addDomListener(window, "resize", function() {
 var center = map.getCenter();
 google.maps.event.trigger(map, "resize");
 map.setCenter(center); 
});
