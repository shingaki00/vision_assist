import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../models/log_model.dart';
import '../services/log_service.dart';

class LogPage extends StatefulWidget {
  const LogPage({super.key});

  @override
  State<LogPage> createState() => _LogPageState();
}

class _LogPageState extends State<LogPage> {
  final LogService _service = LogService();

  GoogleMapController? _mapController;

  Set<Marker> _markers = {};
  Set<Polyline> _polylines = {};

  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadLogs();
  }

  Future<void> _loadLogs() async {
    try {
      final logs = await _service.fetchLogs();

      if (logs.isEmpty) {
        setState(() {
          _isLoading = false;
        });
        return;
      }

      final Set<Marker> markers = {};
      final List<LatLng> routePoints = [];

      for (int i = 0; i < logs.length; i++) {
        final log = logs[i];

        final point = LatLng(
          log.latitude,
          log.longitude,
        );

        routePoints.add(point);

        markers.add(
          Marker(
            markerId: MarkerId("log_$i"),
            position: point,
            infoWindow: InfoWindow(
              title: "ログ ${i + 1}",
              snippet: log.timestamp,
            ),
          ),
        );
      }

      final polyline = Polyline(
        polylineId: const PolylineId("route"),
        points: routePoints,
        width: 5,
      );

      setState(() {
        _markers = markers;
        _polylines = {polyline};
        _isLoading = false;
      });

      final first = logs.first;

      _mapController?.animateCamera(
        CameraUpdate.newLatLngZoom(
          LatLng(
            first.latitude,
            first.longitude,
          ),
          17,
        ),
      );
    } catch (e) {
      debugPrint(e.toString());

      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("移動ログ"),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              setState(() {
                _isLoading = true;
              });

              _loadLogs();
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(),
            )
          : GoogleMap(
              initialCameraPosition: const CameraPosition(
                target: LatLng(
                  35.17091,
                  136.88153,
                ),
                zoom: 15,
              ),
              markers: _markers,
              polylines: _polylines,
              myLocationEnabled: true,
              onMapCreated: (controller) {
                _mapController = controller;
              },
            ),
    );
  }
}
