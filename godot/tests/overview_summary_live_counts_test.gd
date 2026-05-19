extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var factions_before: int = _array(game_state.get("factions")).size()
	var factions: Array = _array(game_state.get("factions")).duplicate(true)
	factions.append({
		"id": "overview-count-test-faction",
		"name": "概览计数测试势力",
		"type": "测试",
		"leader": "测试首领",
		"capital": "测试地",
		"strength": 1,
		"economy": 1,
		"military_strength": 1
	})
	game_state.set("factions", factions)
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/overview_summary_panel.gd")
	if panel == null:
		_fail("Main scene does not expose OverviewSummaryPanel")
		return

	var live_labels: Dictionary = _dict(panel.get("live_summary_value_labels"))
	var factions_label: Label = live_labels.get("factions_count", null) as Label
	if factions_label == null:
		_fail("Overview faction count row is not bound to runtime state")
		return
	if str(factions_label.text) != "%d 个" % (factions_before + 1):
		_fail("Overview faction count row stayed stale after runtime faction count changed")
		return

	print("[TianmingGodotTest] overview summary live counts scene test passed")
	_finish(0)

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _find_node_with_script(root: Node, script_path: String) -> Node:
	var script: Script = root.get_script()
	if script != null and script.resource_path == script_path:
		return root
	for child in root.get_children():
		var found: Node = _find_node_with_script(child, script_path)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	print("[TianmingGodotTest] overview summary live counts scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] overview summary live counts scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
