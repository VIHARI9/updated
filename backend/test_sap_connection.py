import win32com.client


def main():
    try:
        sap_gui = win32com.client.GetObject("SAPGUI")
        application = sap_gui.GetScriptingEngine

        if application.Children.Count == 0:
            raise RuntimeError("No active SAP connection was found.")

        connection = application.Children(0)

        if connection.Children.Count == 0:
            raise RuntimeError("No active SAP session was found.")

        session = connection.Children(0)

        print("SAP GUI connection successful")
        print("System:", session.Info.SystemName)
        print("Client:", session.Info.Client)
        print("Current transaction:", session.Info.Transaction)

    except Exception as exc:
        print("SAP GUI connection failed")
        print(type(exc).__name__ + ":", exc)
        raise


if __name__ == "__main__":
    main()
