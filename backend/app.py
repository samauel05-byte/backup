from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from processors.itbis_processor import load_file, process
import os

app = Flask(__name__, static_folder="../frontend")
CORS(app)

ALLOWED_EXTENSIONS = {"csv", "xlsx", "xls"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(app.static_folder, path)


@app.route("/api/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No se recibió ningún archivo"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Nombre de archivo vacío"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Tipo de archivo no permitido. Use CSV, XLSX o XLS."}), 400

    file_bytes = file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        return jsonify({"error": "El archivo supera el límite de 20 MB"}), 400

    try:
        df = load_file(file_bytes, file.filename)
        result = process(df)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
