extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")

func _ready() -> void:
	var relations: Dictionary = {}
	for i in range(1, 11):
		relations["relation_%02d" % i] = i
	var relations_text: String = ScenarioLoaderScript._relations_text(relations)
	if not relations_text.contains("relation_09") or not relations_text.contains("relation_10"):
		_fail("Scenario loader relation summary omitted later relation keys")
		return

	var region_names: Dictionary = {}
	var neighbors: Array = []
	for i in range(1, 6):
		var id: String = "neighbor_%02d" % i
		neighbors.append(id)
		region_names[id] = "Neighbor Region %02d" % i
	var rows: Array = ScenarioLoaderScript._build_region_rows([
		{
			"name": "Region With Many Neighbors",
			"owner": "ming",
			"terrain": "plain",
			"prosperity": 50,
			"neighbors": neighbors,
		}
	], {"ming": "Ming"}, region_names)
	if rows.is_empty():
		_fail("Scenario loader did not build region rows")
		return
	var neighbor_text: String = str(_dict(rows[0]).get("neighbors", ""))
	if not neighbor_text.contains("Neighbor Region 04") or not neighbor_text.contains("Neighbor Region 05"):
		_fail("Scenario loader region summary omitted later neighbors")
		return

	print("[TianmingGodotTest] scenario loader full-summary scene test passed")
	_finish(0)

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] scenario loader full-summary scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] scenario loader full-summary scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
