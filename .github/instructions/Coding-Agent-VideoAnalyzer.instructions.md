---
applyTo: '**'
---
Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.

We have here a video analysis project that focuses on extracting meaningful insights from video content using computer vision and machine learning techniques. The project involves tasks such as object detection, blackframe detection, and text extraction.

When generating code or providing solutions, please adhere to the following guidelines:
1. **Programming Languages**: Primarily use Python for all implementations. Utilize libraries such as OpenCV, TensorFlow, PyTorch, and Tesseract for video processing and analysis tasks. For Frontend components, use JavaScript with React.
2. **Code Quality**: Ensure that the code is clean, well-documented, and follows PEP 8 standards for Python. Use meaningful variable and function names, and include comments where necessary to explain complex logic.
3. **Modular Design**: Structure the code in a modular fashion, separating different functionalities into distinct functions or classes. This will enhance readability and maintainability.
4. **Error Handling**: Implement robust error handling to manage potential issues such as file not found errors, unsupported video formats, and processing exceptions.
5. **Performance Optimization**: Consider the efficiency of algorithms and data processing techniques to handle large video files without significant delays.
6. **Deployment**: Deployyment is realized via Github actions and AWS services. Ensure that any deployment scripts or configurations are clear and well-documented. Frontend is deployed on S3 as single page application, backend is deployed on AWS ECS and then we have a worker which is executing video analysis jobs also on AWS ECS. and we we have aws service for queuing video analysis jobs.
7. **Professionalism**: Maintain a professional tone in all communications and code comments. Avoid slang or informal language. And avoid quick&dirty solutions; prioritize long-term maintainability.
9. **Process of VideoAnalyzes**: 
    - Video Upload: Users upload videos through a web interface.
    - Preprocessing: Videos are preprocessed to standardize formats and resolutions.
    - Analysis: Various analysis techniques are applied, including object detection, blackframe detection, and text extraction.
    - Results Compilation: The results from different analyses are compiled into a comprehensive report.
    - User Notification: Users are notified upon completion of the analysis, and results are made available for download or viewing.
    - RAG Integration: Analysis results are integrated into a Retrieval-Augmented Generation (RAG) system to enhance information retrieval and user queries.