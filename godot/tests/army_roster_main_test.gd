extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/army_roster_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the army roster panel")
		return
	var text: String = str(panel.call("visible_text"))
	if not text.contains("关宁军主力") or not text.contains("红衣大炮"):
		_fail("Main army roster panel did not display official army details")
		return

	print("[TianmingGodotTest] army roster main scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

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
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] army roster main scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
