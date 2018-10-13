Implement default dom filter..

But requires more explicit filtering of src attributes

e.g. src="java\nscript:alert(0)"

function domFilter (nodeName, attributes) {
        // Filter all attributes that start with on*. E.g. onclick does execute code
        // If key is 'href' or 'src', filter everything but 'http*', 'blob*', or 'data:image*' urls
        attributes.forEach(function (value, key) {
            key = key.toLowerCase();
            value = value.toLowerCase();
            if (key != null && (
                // filter all attributes starting with 'on'
                key.substr(0, 2) === 'on' ||
                // if key is 'href' or 'src', filter everything but http, blob, or data:image
                (
                    (key === 'href' || key === 'src') &&
                    value.substr(0, 4) !== 'http' &&
                    value.substr(0, 4) !== 'blob' &&
                    value.substr(0, 10) !== 'data:image'
                )
            )) {
                attributes.delete(key);
            }
        });
        switch (nodeName) {
        case 'SCRIPT':
            return null;
        case 'EN-ADORNMENTS':
            // TODO: Remove EN-ADORNMENTS check when merged into master branch!
            return null;
        case 'EN-TABLE':
            attributes.delete('class');
            return attributes;
        case 'EN-COMMENT':
            attributes.delete('style');
            attributes.delete('class');
            return attributes;
        case 'SPAN':
            return (attributes.get('id') || '').substr(0, 5) === 'goog_' ? null : attributes;
        case 'TD':
            attributes.delete('class');
            return attributes;
        case 'EMBED':
            attributes.delete('src');
            attributes.delete('style');
            attributes.delete('data-reference');
            return attributes;
        case 'FORM':
            attributes.delete('action');
            return attributes;
        default:
            return (nodeName || '').substr(0, 3) === 'UI-' ? null : attributes;
        }
    }
