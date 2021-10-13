// react
import React, { useState, useEffect, useRef, useCallback } from 'react'

// openlayers
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'
import { Draw, Modify } from 'ol/interaction'
import OSM from 'ol/source/OSM'
import { Feature } from 'ol'
import Button, { ButtonProps } from '@material-ui/core/Button'
import GeoJSON from 'ol/format/GeoJSON'

type FeaturesType = Feature<any>[] | undefined
interface MapProps extends ButtonProps {
  features: any
  featureType: 'Point' | 'Polygon' | 'Circle' | 'LineString'
  zoom: number
  center: Array<number>
  callbackFn: (features: FeaturesType) => void
}

const styles = {
  mapInputWidget: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100vh',
    width: '100%',
    display: 'grid',
    gridTemplateRows: '1fr 100px',
    zIndex: 100
  },
  mapContainer: {
    gridRow: 1
  },
  mapSubmitButton: {
    gridRow: 2
  }
} as const

function MapWrapper(props: MapProps) {
  // set intial state
  const [map, setMap] = useState<Map | undefined>()
  const [featuresLayer, setFeaturesLayer] =
    useState<VectorLayer<VectorSource<any>>>()

  const gjson = new GeoJSON()

  // pull refs
  const mapElement = useRef<HTMLDivElement>(null)

  // create state ref that can be accessed in OpenLayers onclick callback function
  //  https://stackoverflow.com/a/60643670
  const mapRef = useRef<Map | undefined>()
  mapRef.current = map

  const createMap = useCallback(
    (element: HTMLElement, props: MapProps): Map => {
      // const featuresLayer = createBaseLayer(props.features);

      const theMap = new Map({
        target: element,
        layers: [
          new TileLayer({ source: new OSM() })
          // featuresLayer
        ],
        view: new View({
          projection: 'EPSG:3857',
          center: props.center,
          zoom: props.zoom
        }),
        controls: []
      })

      theMap.getView().setCenter(props.center)

      return theMap
    },
    []
  )

  const addDrawInteraction = useCallback(
    (map: Map, props: MapProps) => {
      const source = new VectorSource()

      const layer = new VectorLayer({
        source: source,
        style: new Style({
          stroke: new Stroke({
            color: '#33ff33',
            width: 4
          }),
          image: new CircleStyle({
            radius: 7,
            fill: new Fill({ color: '#33ff33' })
          })
        })
      })
      const draw = new Draw({
        source: source,
        type: props.featureType || 'Point'
      })
      const modify = new Modify({
        source: source
      })

      // add features to map if we're passed any in
      if (props.features && props.features.type) {
        const parsedFeatures = gjson.readFeatures(props.features, {
          dataProjection: 'EPSG:4326',
          featureProjection: map.getView().getProjection()
        })

        source.addFeatures(parsedFeatures)
      }

      // setDrawInteraction(draw)

      map.addLayer(layer)
      map.addInteraction(draw)
      map.addInteraction(modify)
      setFeaturesLayer(layer)

      draw.on('drawstart', () => {
        // clear any existing features if we start drawing again
        // could allow up to a fixed number of features
        // here by counting
        source.clear()
      })
    },
    [setFeaturesLayer]
  )

  // initialize map on first render
  useEffect(() => {
    // don't do this if we have already made a map
    if (!map) {
      // create and add vector source layer containing the passed in features
      if (mapElement.current) {
        // create map
        const initialMap = createMap(mapElement.current, props)
        addDrawInteraction(initialMap, props)
        setMap(initialMap)
      }
    }
  }, [map, createMap, addDrawInteraction, props])

  const submitAction = () => {
    if (featuresLayer) {
      const features = featuresLayer.getSource().getFeatures()

      if (map) {
        const transFeatures: Array<Feature<any>> = []
        console.log(features)
        features.forEach((feature) => {
          const geometry = feature
            .getGeometry()
            .clone()
            .transform(map.getView().getProjection(), 'EPSG:4326')
          const newFeature = feature.clone()
          newFeature.setGeometry(geometry)
          transFeatures.push(newFeature)
        })
        const geojFeatures = gjson.writeFeaturesObject(transFeatures, {
          dataProjection: 'EPSG:4326'
        })
        console.log('GJ', geojFeatures)

        props.callbackFn(geojFeatures)
        featuresLayer.getSource().clear()
      }
    }
  }

  // render component
  return (
    <div style={styles.mapInputWidget}>
      <div ref={mapElement} style={styles.mapContainer} />
      <Button
        type='button'
        variant='outlined'
        color='primary'
        style={styles.mapSubmitButton}
        onClick={submitAction}
      >
        Submit
      </Button>
    </div>
  )
}

export default MapWrapper